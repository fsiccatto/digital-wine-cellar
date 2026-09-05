"""El reintento ante errores pasajeros de la API de Sheets.

Paso de verdad: un 503 de Google durante un listado le llegaba al usuario como
un 500. Lo que se cuida aca es que se reintente lo que es seguro reintentar, y
solo eso.
"""

from unittest.mock import Mock, patch

import gspread
import pytest

from app.services import sheets_service


def api_error(code: int) -> gspread.exceptions.APIError:
    """Un APIError como el que arma gspread a partir de la respuesta HTTP."""
    respuesta = Mock()
    respuesta.json.return_value = {
        "error": {"code": code, "message": "The service is currently unavailable."}
    }
    return gspread.exceptions.APIError(respuesta)


@pytest.fixture(autouse=True)
def sin_esperas():
    # El backoff real haria que los tests tarden segundos.
    with patch("app.services.sheets_service.time.sleep"):
        yield


class TestReintento:
    def test_el_503_se_reintenta_y_termina_bien(self):
        operacion = Mock(side_effect=[api_error(503), "listo"])

        assert sheets_service._retry(operacion) == "listo"
        assert operacion.call_count == 2

    @pytest.mark.parametrize("code", [429, 500, 502, 503, 504])
    def test_todos_los_pasajeros_se_reintentan(self, code):
        operacion = Mock(side_effect=[api_error(code), "listo"])

        assert sheets_service._retry(operacion) == "listo"
        assert operacion.call_count == 2

    @pytest.mark.parametrize("code", [400, 403, 404])
    def test_los_errores_reales_no_se_reintentan(self, code):
        # Un 403 es la planilla sin compartir: reintentar no la va a arreglar y
        # solo retrasa el error que hay que ver.
        operacion = Mock(side_effect=api_error(code))

        with pytest.raises(gspread.exceptions.APIError):
            sheets_service._retry(operacion)

        assert operacion.call_count == 1

    def test_se_rinde_despues_del_ultimo_intento(self):
        operacion = Mock(side_effect=api_error(503))

        with pytest.raises(gspread.exceptions.APIError):
            sheets_service._retry(operacion)

        assert operacion.call_count == sheets_service.RETRY_ATTEMPTS

    def test_lo_que_anda_a_la_primera_se_llama_una_sola_vez(self):
        operacion = Mock(return_value="listo")

        assert sheets_service._retry(operacion, "arg", kw=1) == "listo"
        operacion.assert_called_once_with("arg", kw=1)

    def test_el_backoff_crece(self):
        operacion = Mock(side_effect=[api_error(503), api_error(503), "listo"])

        with patch("app.services.sheets_service.time.sleep") as dormir:
            assert sheets_service._retry(operacion) == "listo"

        esperas = [llamada.args[0] for llamada in dormir.call_args_list]
        assert esperas == sorted(esperas)
        assert len(esperas) == 2


class TestQueSeReintentaYQueNo:
    """Reintentar una escritura no idempotente duplica datos: el limite de que
    se envuelve y que no es parte del contrato."""

    def test_un_listado_sobrevive_un_503(self):
        worksheet = Mock()
        worksheet.get_all_values.side_effect = [
            api_error(503),
            [sheets_service.INVENTORY_HEADERS, ["1"] * len(sheets_service.INVENTORY_HEADERS)],
        ]

        filas = sheets_service._rows_from(worksheet)

        assert len(filas) == 1
        assert worksheet.get_all_values.call_count == 2

    def test_agregar_una_fila_no_se_reintenta(self):
        # Un 503 puede llegar con la fila ya escrita: reintentar cargaria el
        # vino dos veces.
        worksheet = Mock()
        worksheet.append_row.side_effect = api_error(503)

        with (
            patch.object(sheets_service, "get_inventory_worksheet", return_value=worksheet),
            pytest.raises(gspread.exceptions.APIError),
        ):
            sheets_service.append_inventory_row({"bodega": "X"})

        assert worksheet.append_row.call_count == 1

    def test_borrar_una_fila_no_se_reintenta(self):
        # Al borrar, las filas de abajo suben: un reintento se llevaria puesta
        # la siguiente.
        worksheet = Mock()
        worksheet.get_all_values.return_value = [
            sheets_service.CATAS_HEADERS,
            ["cata-1"] + [""] * (len(sheets_service.CATAS_HEADERS) - 1),
        ]
        worksheet.delete_rows.side_effect = api_error(503)

        with pytest.raises(gspread.exceptions.APIError):
            sheets_service._delete_row(worksheet, "id_cata", "cata-1", "no está")

        assert worksheet.delete_rows.call_count == 1
