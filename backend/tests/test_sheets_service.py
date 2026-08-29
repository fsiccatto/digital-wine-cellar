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

    rows = sheets_service._rows_from(worksheet)

    assert len(rows) == 1
    assert rows[0]["codigo_vino"] == "TRA-MAL-2020-0001"


CATAS_HEADERS = sheets_service.CATAS_HEADERS


class FakeCatasWorksheet(FakeWorksheet):
    def __init__(self, rows):
        self.values = [list(CATAS_HEADERS), *rows]
        self.updates = []
        self.deleted = []


def cata_values(id_cata, puntuacion="3"):
    base = {
        "id_cata": id_cata,
        "vino_id": "TRA-MAL-2020-0001",
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
    assert range_name == "A3:F3"

    written = dict(zip(CATAS_HEADERS, values[0]))
    assert written["puntuacion"] == 5
    # Columnas ausentes del payload: intactas.
    assert written["id_cata"] == "cata-2"
    assert written["vino_id"] == "TRA-MAL-2020-0001"
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
