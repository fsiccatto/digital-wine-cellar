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
