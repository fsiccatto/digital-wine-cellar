"""Tests de la capa de Sheets con una worksheet falsa.

Es donde está el riesgo real: cuántas escrituras se hacen contra el límite del
free tier, y si una escritura de fila pisa columnas que el payload no trae.
"""

from unittest.mock import patch

from app.services import sheets_service

HEADERS = sheets_service.INVENTORY_HEADERS


def row_for(codigo: str, **overrides) -> list:
    base = {
        "id": f"uuid-{codigo}",
        "fecha_ingreso": "2026-01-01T10:00:00",
        "bodega": "Trapiche",
        "nombre_vino": "Fond de Cave",
        "varietal": "Malbec",
        "anada": "2020",
        "region": "Mendoza",
        "alcohol": "14%",
        "cantidad": "3",
        "ubicacion": "Estante A",
        "precio_estimado": "32000",
        "foto_url": "etiquetas/foto.jpg",
        "codigo_vino": codigo,
    }
    base.update(overrides)
    return [base[header] for header in HEADERS]


class FakeWorksheet:
    title = "Inventario"

    def __init__(self, rows):
        self.values = [list(HEADERS), *rows]
        self.updates = []
        self.deleted = []

    def get_all_values(self):
        return self.values

    def update(self, values, range_name):
        self.updates.append((values, range_name))

    def delete_rows(self, row_number):
        self.deleted.append(row_number)


def test_update_inventory_row_writes_once_and_keeps_absent_columns():
    worksheet = FakeWorksheet([row_for("OTRO-VIN-2019-0001"), row_for("TRA-MAL-2020-0001")])

    with patch.object(sheets_service, "get_inventory_worksheet", return_value=worksheet):
        sheets_service.update_inventory_row(
            "TRA-MAL-2020-0001", {"bodega": "Catena", "anada": 2021}
        )

    assert len(worksheet.updates) == 1, "editar N campos debe costar una sola escritura"
    values, range_name = worksheet.updates[0]

    # El vino buscado es el segundo: encabezado + una fila antes = fila 3.
    assert range_name == "A3:M3"

    written = dict(zip(HEADERS, values[0]))
    assert written["bodega"] == "Catena"
    assert written["anada"] == 2021
    # Columnas ausentes del payload: intactas, no vaciadas.
    assert written["codigo_vino"] == "TRA-MAL-2020-0001"
    assert written["cantidad"] == "3"
    assert written["foto_url"] == "etiquetas/foto.jpg"
    assert written["id"] == "uuid-TRA-MAL-2020-0001"
    assert written["fecha_ingreso"] == "2026-01-01T10:00:00"


def test_update_inventory_row_rejects_unknown_code():
    worksheet = FakeWorksheet([row_for("TRA-MAL-2020-0001")])

    with patch.object(sheets_service, "get_inventory_worksheet", return_value=worksheet):
        try:
            sheets_service.update_inventory_row("NO-EXISTE", {"bodega": "Catena"})
        except ValueError:
            pass
        else:
            raise AssertionError("debía fallar con un código inexistente")

    assert worksheet.updates == []


def test_delete_inventory_row_uses_one_based_index():
    worksheet = FakeWorksheet([row_for("UNO-VIN-2019-0001"), row_for("DOS-VIN-2020-0001")])

    with patch.object(sheets_service, "get_inventory_worksheet", return_value=worksheet):
        sheets_service.delete_inventory_row("DOS-VIN-2020-0001")

    # Fila 1 = encabezado, fila 2 = el primer vino, fila 3 = el buscado.
    assert worksheet.deleted == [3]


def test_rows_from_skips_blank_rows():
    worksheet = FakeWorksheet([row_for("TRA-MAL-2020-0001"), [""] * len(HEADERS)])

    rows = sheets_service._rows_from(worksheet, HEADERS)

    assert len(rows) == 1
    assert rows[0]["codigo_vino"] == "TRA-MAL-2020-0001"


CATAS_HEADERS = sheets_service.CATAS_HEADERS


class FakeCatasWorksheet(FakeWorksheet):
    title = "Historico_Catas"

    def __init__(self, rows):
        self.values = [list(CATAS_HEADERS), *rows]
        self.updates = []
        self.deleted = []


def cata_values(id_cata, puntuacion="3"):
    base = {
        "id_cata": id_cata,
        "vino_id": "a1b2c3d4-0000-4000-8000-000000000001",
        "codigo_vino": "TRA-MAL-2020-0001",
        "fecha_consumo": "2026-02-01T21:00:00",
        "puntuacion": puntuacion,
        "notas_cata": "Cerrado al principio",
        "maridaje": "Cordero",
    }
    return [base[header] for header in CATAS_HEADERS]


def test_update_cata_row_writes_once_and_keeps_the_wine_and_date():
    worksheet = FakeCatasWorksheet([cata_values("cata-1"), cata_values("cata-2")])

    with patch.object(sheets_service, "get_catas_worksheet", return_value=worksheet):
        sheets_service.update_cata_row("cata-2", {"puntuacion": 5})

    assert len(worksheet.updates) == 1
    values, range_name = worksheet.updates[0]
    # El rango cubre las columnas que hay, sean las que sean: escribir de menos
    # dejaria basura de la fila vieja en las de la derecha.
    ultima = chr(ord("A") + len(CATAS_HEADERS) - 1)
    assert range_name == f"A3:{ultima}3"

    written = dict(zip(CATAS_HEADERS, values[0]))
    assert written["puntuacion"] == 5
    # Columnas ausentes del payload: intactas.
    assert written["id_cata"] == "cata-2"
    assert written["vino_id"] == "a1b2c3d4-0000-4000-8000-000000000001"
    assert written["codigo_vino"] == "TRA-MAL-2020-0001"
    assert written["fecha_consumo"] == "2026-02-01T21:00:00"


def test_delete_cata_row_uses_one_based_index():
    worksheet = FakeCatasWorksheet([cata_values("cata-1"), cata_values("cata-2")])

    with patch.object(sheets_service, "get_catas_worksheet", return_value=worksheet):
        sheets_service.delete_cata_row("cata-2")

    assert worksheet.deleted == [3]


def test_update_cata_row_rejects_unknown_id():
    worksheet = FakeCatasWorksheet([cata_values("cata-1")])

    with patch.object(sheets_service, "get_catas_worksheet", return_value=worksheet):
        try:
            sheets_service.update_cata_row("no-existe", {"puntuacion": 5})
        except ValueError:
            pass
        else:
            raise AssertionError("debía fallar con un id inexistente")

    assert worksheet.updates == []

class FakeAppendWorksheet:
    """Una pestaña que puede tener el encabezado de un esquema anterior."""

    def __init__(self, header, title="Historico_Catas"):
        self.title = title
        self.header = list(header)
        self.appended = []
        self.updates = []
        self.col_count = len(header)
        self.lecturas = 0

    def get_all_values(self):
        self.lecturas += 1
        return [list(self.header)]

    def append_row(self, values):
        self.appended.append(values)

    def update(self, values, range_name):
        self.updates.append((values, range_name))
        self.header = list(values[0])

    def add_cols(self, n):
        self.col_count += n


def test_append_repara_un_encabezado_viejo_antes_de_escribir():
    """append_row escribe POR POSICION: con la fila 1 vieja, todo cae corrido.

    Es el bug que aparecio al agregar `codigo_vino`: la hoja tenia el encabezado
    de seis columnas, la fila nueva se escribio con siete y cada valor termino
    una celda a la derecha de donde iba.
    """
    viejo = [h for h in sheets_service.CATAS_HEADERS if h != "codigo_vino"]
    worksheet = FakeAppendWorksheet(viejo)

    with patch.object(sheets_service, "get_catas_worksheet", return_value=worksheet):
        sheets_service.append_cata_record(
            {"id_cata": "c1", "vino_id": "uuid-1", "codigo_vino": "TRA-MAL-2020-0001"}
        )

    assert worksheet.header == sheets_service.CATAS_HEADERS, "no reparo el encabezado"
    escrita = dict(zip(sheets_service.CATAS_HEADERS, worksheet.appended[0]))
    assert escrita["vino_id"] == "uuid-1"
    assert escrita["codigo_vino"] == "TRA-MAL-2020-0001"


def test_el_encabezado_se_verifica_una_sola_vez_por_proceso():
    """La garantia no puede costar una llamada por escritura."""
    worksheet = FakeAppendWorksheet(sheets_service.CATAS_HEADERS)
    sheets_service._headers_ok.discard(worksheet.title)

    with patch.object(sheets_service, "get_catas_worksheet", return_value=worksheet):
        for _ in range(3):
            sheets_service.append_cata_record({"id_cata": "c", "vino_id": "u"})

    assert worksheet.lecturas == 1
    assert len(worksheet.appended) == 3


def test_una_lectura_previa_deja_el_append_sin_costo():
    """Si ya se leyo la pestaña, el encabezado quedo verificado ahi."""
    worksheet = FakeAppendWorksheet(sheets_service.CATAS_HEADERS)
    sheets_service._headers_ok.discard(worksheet.title)

    sheets_service._rows_from(worksheet, sheets_service.CATAS_HEADERS)
    with patch.object(sheets_service, "get_catas_worksheet", return_value=worksheet):
        sheets_service.append_cata_record({"id_cata": "c", "vino_id": "u"})

    assert worksheet.lecturas == 1, "el append no debia volver a leer"


class FakeHojaCompleta:
    """Una pestaña con datos, para ver que pasa con las filas y no solo la 1."""

    def __init__(self, values, title="Historico_Catas"):
        self.title = title
        self.values = [list(fila) for fila in values]
        self.col_count = max(len(fila) for fila in values)
        self.updates = []
        self.batches = []

    def get_all_values(self):
        return [list(fila) for fila in self.values]

    def update(self, values, range_name):
        self.updates.append((values, range_name))
        self.values = [list(fila) for fila in values]

    def batch_update(self, data):
        self.batches.append(data)
        for item in data:
            numero = int(item["range"].split(":")[0][1:])
            fila = item["values"][0]
            self.values[numero - 1][: len(fila)] = fila

    def add_cols(self, n):
        self.col_count += n


VIEJO = [h for h in CATAS_HEADERS if h != "codigo_vino"]
# Una cata escrita con el esquema de seis columnas, en el orden de entonces.
FILA_VIEJA = ["cata-1", "uuid-1", "2026-08-20T21:30:00", "3.5", "", "Asado"]


def test_un_esquema_nuevo_reacomoda_los_datos_y_no_solo_el_encabezado():
    """Sumar una columna en el medio no puede correr las filas que ya estaban."""
    worksheet = FakeHojaCompleta([VIEJO, FILA_VIEJA])
    sheets_service._headers_ok.discard(worksheet.title)

    filas = sheets_service._rows_from(worksheet, CATAS_HEADERS)

    assert worksheet.values[0] == CATAS_HEADERS
    assert filas[0]["fecha_consumo"] == "2026-08-20T21:30:00"
    assert filas[0]["puntuacion"] == "3.5"
    assert filas[0]["maridaje"] == "Asado"
    assert filas[0]["codigo_vino"] == ""
    # Y queda escrito asi: la proxima lectura ya no tiene que reacomodar nada.
    assert dict(zip(CATAS_HEADERS, worksheet.values[1]))["fecha_consumo"] == (
        "2026-08-20T21:30:00"
    )


def test_una_columna_desconocida_se_conserva_al_final():
    worksheet = FakeHojaCompleta([[*VIEJO, "comentario"], [*FILA_VIEJA, "a mano"]])

    sheets_service._rows_from(worksheet, CATAS_HEADERS)

    assert worksheet.values[0] == [*CATAS_HEADERS, "comentario"]
    assert worksheet.values[1][-1] == "a mano"


def test_las_catas_que_ya_quedaron_corridas_se_enderezan():
    """El dato que se veia como "5 mar 2001": la puntuacion bajo fecha_consumo.

    Es lo que dejo en produccion reescribir solo el encabezado: la hoja tiene
    el esquema nuevo y la fila vieja sigue con sus seis valores en su lugar.
    """
    sana = cata_values("cata-2")
    worksheet = FakeHojaCompleta([CATAS_HEADERS, [*FILA_VIEJA, ""], sana])

    filas = sheets_service._rows_from(worksheet, CATAS_HEADERS)

    corrida = next(f for f in filas if f["id_cata"] == "cata-1")
    assert corrida["fecha_consumo"] == "2026-08-20T21:30:00"
    assert corrida["puntuacion"] == "3.5"
    assert corrida["maridaje"] == "Asado"
    # Solo se escribe la fila rota, en una llamada.
    assert len(worksheet.batches) == 1
    assert [item["range"] for item in worksheet.batches[0]] == ["A2:G2"]
    assert worksheet.values[2] == sana

    # Arreglada una vez, no se vuelve a tocar.
    sheets_service._rows_from(worksheet, CATAS_HEADERS)
    assert len(worksheet.batches) == 1


def test_no_se_corre_una_fila_que_tiene_la_ultima_celda_ocupada():
    """Si la ultima celda tiene algo, no es una fila del esquema viejo."""
    rara = ["cata-3", "uuid-1", "2026-08-20T21:30:00", "3.5", "", "Asado", "Algo"]
    worksheet = FakeHojaCompleta([CATAS_HEADERS, rara])

    sheets_service._rows_from(worksheet, CATAS_HEADERS)

    assert worksheet.batches == []
    assert worksheet.values[1] == rara
