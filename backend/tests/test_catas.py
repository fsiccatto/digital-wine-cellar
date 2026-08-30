"""Editar, borrar y registrar catas sueltas."""

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.wine_schema import CataCreateInput, CataRecord, CataUpdateInput
from app.services import wine_service

client = TestClient(app)


def inventory_row(codigo="TRA-MAL-2020-0001", **overrides):
    row = {
        "id": "internal-uuid",
        "codigo_vino": codigo,
        "fecha_ingreso": "2026-01-01T10:00:00",
        "bodega": "Trapiche",
        "nombre_vino": "Fond de Cave",
        "varietal": "Malbec",
        "anada": "2020",
        "region": "Mendoza",
        "alcohol": "14",
        "cantidad": "3",
        "ubicacion": "A1",
        "precio_estimado": "32000",
        "foto_url": "",
    }
    row.update(overrides)
    return row


def cata_row(id_cata="cata-1", **overrides):
    row = {
        "id_cata": id_cata,
        "vino_id": "TRA-MAL-2020-0001",
        "fecha_consumo": "2026-02-01T21:00:00",
        "puntuacion": "3",
        "notas_cata": "Cerrado al principio",
        "maridaje": "Cordero",
    }
    row.update(overrides)
    return row


class TestAgregarCataSuelta:
    def test_no_descuenta_stock(self):
        """Es la diferencia con descorchar: anota sin tocar el inventario."""
        with (
            patch.object(wine_service, "get_inventory_rows", return_value=[inventory_row()]),
            patch.object(wine_service, "append_cata_record") as append_cata,
            patch.object(wine_service, "update_inventory_quantity") as update_quantity,
        ):
            result = wine_service.add_cata(
                "TRA-MAL-2020-0001", CataCreateInput(puntuacion=5)
            )

        update_quantity.assert_not_called()
        append_cata.assert_called_once()
        assert result.puntuacion == 5
        assert result.vino_existe is True
        assert result.nombre_vino == "Fond de Cave"

    def test_usa_la_fecha_dada(self):
        with (
            patch.object(wine_service, "get_inventory_rows", return_value=[inventory_row()]),
            patch.object(wine_service, "append_cata_record") as append_cata,
        ):
            wine_service.add_cata(
                "TRA-MAL-2020-0001",
                CataCreateInput(puntuacion=4, fecha_consumo="2026-05-10T20:00:00"),
            )

        assert append_cata.call_args.args[0]["fecha_consumo"] == "2026-05-10T20:00:00"

    def test_sin_fecha_usa_ahora(self):
        with (
            patch.object(wine_service, "get_inventory_rows", return_value=[inventory_row()]),
            patch.object(wine_service, "append_cata_record") as append_cata,
        ):
            wine_service.add_cata("TRA-MAL-2020-0001", CataCreateInput(puntuacion=4))

        # No explota al parsear: la puso el servidor.
        datetime.fromisoformat(append_cata.call_args.args[0]["fecha_consumo"])

    def test_rechaza_una_fecha_futura(self):
        manana = (datetime.now() + timedelta(days=1)).isoformat(timespec="seconds")
        with pytest.raises(ValueError):
            CataCreateInput(puntuacion=4, fecha_consumo=manana)

    def test_rechaza_un_vino_inexistente(self):
        with (
            patch.object(wine_service, "get_inventory_rows", return_value=[]),
            patch.object(wine_service, "append_cata_record") as append_cata,
        ):
            with pytest.raises(ValueError):
                wine_service.add_cata("NO-EXISTE", CataCreateInput(puntuacion=4))

        append_cata.assert_not_called()


class TestEditarCata:
    def test_corrige_la_puntuacion_sin_mover_el_stock(self):
        with (
            patch.object(wine_service, "get_catas_rows", return_value=[cata_row()]),
            patch.object(wine_service, "get_inventory_rows", return_value=[inventory_row()]),
            patch.object(wine_service, "update_cata_row") as update_row,
            patch.object(wine_service, "update_inventory_quantity") as update_quantity,
        ):
            result = wine_service.update_cata(
                "cata-1", CataUpdateInput(puntuacion=5, notas_cata="Mejoró en la copa")
            )

        update_quantity.assert_not_called()
        assert result.puntuacion == 5
        assert result.notas_cata == "Mejoró en la copa"
        # El maridaje no venía en el payload y se vacía: es un PUT, no un PATCH.
        assert update_row.call_args.args[1]["maridaje"] == ""

    def test_no_cambia_de_vino_ni_de_fecha(self):
        """Mover una cata de vino la convierte en otra cata."""
        with (
            patch.object(wine_service, "get_catas_rows", return_value=[cata_row()]),
            patch.object(wine_service, "get_inventory_rows", return_value=[inventory_row()]),
            patch.object(wine_service, "update_cata_row") as update_row,
        ):
            result = wine_service.update_cata("cata-1", CataUpdateInput(puntuacion=2))

        escrito = update_row.call_args.args[1]
        assert "vino_id" not in escrito
        assert "fecha_consumo" not in escrito
        assert result.vino_id == "TRA-MAL-2020-0001"
        assert result.fecha_consumo == "2026-02-01T21:00:00"

    def test_una_cata_huerfana_se_puede_editar(self):
        """El vino se borró pero la cata sigue siendo corregible."""
        with (
            patch.object(wine_service, "get_catas_rows", return_value=[cata_row()]),
            patch.object(wine_service, "get_inventory_rows", return_value=[]),
            patch.object(wine_service, "update_cata_row"),
        ):
            result = wine_service.update_cata("cata-1", CataUpdateInput(puntuacion=1))

        assert result.puntuacion == 1
        assert result.vino_existe is False
        assert result.nombre_vino is None

    def test_rechaza_una_cata_inexistente(self):
        with (
            patch.object(wine_service, "get_catas_rows", return_value=[]),
            patch.object(wine_service, "update_cata_row") as update_row,
        ):
            with pytest.raises(ValueError):
                wine_service.update_cata("no-existe", CataUpdateInput(puntuacion=3))

        update_row.assert_not_called()


class TestBorrarCata:
    def test_no_devuelve_la_botella_al_stock(self):
        """La botella se tomó igual: devolverla seria inventar stock."""
        with (
            patch.object(wine_service, "get_catas_rows", return_value=[cata_row()]),
            patch.object(wine_service, "delete_cata_row") as delete_row,
            patch.object(wine_service, "update_inventory_quantity") as update_quantity,
        ):
            result = wine_service.delete_cata("cata-1")

        update_quantity.assert_not_called()
        delete_row.assert_called_once_with("cata-1")
        assert result == {"status": "ok", "id_cata": "cata-1"}

    def test_rechaza_una_cata_inexistente(self):
        with (
            patch.object(wine_service, "get_catas_rows", return_value=[]),
            patch.object(wine_service, "delete_cata_row") as delete_row,
        ):
            with pytest.raises(ValueError):
                wine_service.delete_cata("no-existe")

        delete_row.assert_not_called()


class TestRutas:
    def test_put_cata_inexistente_es_404(self):
        with patch("app.routes.wines.update_cata", side_effect=ValueError("no existe")):
            response = client.put("/api/catas/no-existe", json={"puntuacion": 4})
        assert response.status_code == 404

    def test_delete_cata_inexistente_es_404(self):
        with patch("app.routes.wines.delete_cata", side_effect=ValueError("no existe")):
            response = client.delete("/api/catas/no-existe")
        assert response.status_code == 404

    def test_puntuacion_fuera_de_rango_es_422(self):
        response = client.put("/api/catas/cata-1", json={"puntuacion": 9})
        assert response.status_code == 422

    def test_no_se_puede_mover_la_cata_de_vino(self):
        # extra="forbid": mandar vino_id es un error del cliente, no algo que se ignora.
        response = client.put(
            "/api/catas/cata-1", json={"puntuacion": 4, "vino_id": "OTRO-VIN-2020-0001"}
        )
        assert response.status_code == 422

    def test_post_cata_en_vino_inexistente_es_404(self):
        with patch("app.routes.wines.add_cata", side_effect=ValueError("no existe")):
            response = client.post("/api/wines/NO-EXISTE/catas", json={"puntuacion": 4})
        assert response.status_code == 404


class TestMediaCopa:
    """Cinco copas grandes pero diez valores: media copa es medio punto."""

    @pytest.mark.parametrize("valor", [0.5, 2.5, 4.5, 5])
    def test_acepta_medios_puntos(self, valor):
        assert CataUpdateInput(puntuacion=valor).puntuacion == valor

    @pytest.mark.parametrize("valor", [4.3, 2.7, 1.25])
    def test_rechaza_lo_que_no_cae_en_media_copa(self, valor):
        with pytest.raises(ValidationError):
            CataUpdateInput(puntuacion=valor)

    @pytest.mark.parametrize("valor", [0, 5.5, 6, -1])
    def test_rechaza_fuera_de_rango(self, valor):
        with pytest.raises(ValidationError):
            CataUpdateInput(puntuacion=valor)

    def test_una_puntuacion_con_coma_del_sheet_se_entiende(self):
        # El Sheet devuelve las celdas con formato como texto.
        assert CataRecord(
            id_cata="c1",
            vino_id="TRA-MAL-2020-0001",
            fecha_consumo="2026-02-01T21:00:00",
            puntuacion="4,5",
        ).puntuacion == 4.5
