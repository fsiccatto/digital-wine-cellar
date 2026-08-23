import os
from typing import Any, Dict, List

import gspread
from gspread.utils import rowcol_to_a1

from app.config import GOOGLE_SHEETS_CREDENTIALS_FILE, GOOGLE_SHEET_NAME

INVENTORY_HEADERS = [
    "id",
    "fecha_ingreso",
    "bodega",
    "nombre_vino",
    "varietal",
    "anada",
    "region",
    "alcohol",
    "cantidad",
    "ubicacion",
    "precio_estimado",
    "foto_url",
    "codigo_vino",
]

CATAS_HEADERS = [
    "id_cata",
    "vino_id",
    "fecha_consumo",
    "puntuacion",
    "notas_cata",
    "maridaje",
]

INVENTORY_TAB = "Inventario"
CATAS_TAB = "Historico_Catas"

_spreadsheet = None
_worksheets: Dict[str, Any] = {}


def get_spreadsheet():
    global _spreadsheet
    if _spreadsheet is not None:
        return _spreadsheet

    if not os.path.exists(GOOGLE_SHEETS_CREDENTIALS_FILE):
        raise FileNotFoundError(
            f"No se encontró el archivo de credenciales: {GOOGLE_SHEETS_CREDENTIALS_FILE}. "
            "Copia el JSON del Service Account y colócalo en backend/credentials.json."
        )

    gc = gspread.service_account(filename=GOOGLE_SHEETS_CREDENTIALS_FILE)
    _spreadsheet = gc.open(GOOGLE_SHEET_NAME)
    return _spreadsheet


def _get_worksheet(title: str, headers: List[str]):
    """Resolve a worksheet once per process, creating the tab and header row if absent."""
    if title in _worksheets:
        return _worksheets[title]

    spreadsheet = get_spreadsheet()
    try:
        worksheet = spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=title, rows=100, cols=len(headers))
        worksheet.append_row(headers)
        _worksheets[title] = worksheet
        return worksheet

    first_row = worksheet.row_values(1)
    if not first_row:
        worksheet.append_row(headers)
    elif first_row != headers:
        # La fila 1 ya es un encabezado (posiblemente de un esquema anterior):
        # se reescribe en lugar de insertar, para no duplicarla en cada arranque.
        if worksheet.col_count < len(headers):
            worksheet.add_cols(len(headers) - worksheet.col_count)
        worksheet.update([headers], f"A1:{rowcol_to_a1(1, len(headers))}")

    _worksheets[title] = worksheet
    return worksheet


def get_inventory_worksheet():
    return _get_worksheet(INVENTORY_TAB, INVENTORY_HEADERS)


def get_catas_worksheet():
    return _get_worksheet(CATAS_TAB, CATAS_HEADERS)


def get_inventory_rows() -> List[Dict[str, Any]]:
    values = get_inventory_worksheet().get_all_values()
    if len(values) <= 1:
        return []

    headers = values[0]
    rows = []
    for row in values[1:]:
        if not any(cell for cell in row):
            continue
        rows.append({header: row[i] if i < len(row) else "" for i, header in enumerate(headers)})
    return rows


def append_inventory_row(row: Dict[str, Any]):
    worksheet = get_inventory_worksheet()
    worksheet.append_row([row.get(header, "") for header in INVENTORY_HEADERS])


def _update_inventory_cell(codigo_vino: str, column: str, value: Any, missing: str):
    worksheet = get_inventory_worksheet()
    rows = worksheet.get_all_values()
    if len(rows) <= 1:
        raise ValueError("El inventario está vacío.")

    headers = rows[0]
    target_column = headers.index(column) + 1
    code_index = headers.index("codigo_vino")

    for row_number, row in enumerate(rows[1:], start=2):
        if len(row) > code_index and row[code_index] == codigo_vino:
            worksheet.update_cell(row_number, target_column, value)
            return

    raise ValueError(missing)


def update_inventory_quantity(codigo_vino: str, quantity: int):
    _update_inventory_cell(
        codigo_vino,
        "cantidad",
        quantity,
        "No se encontró el vino solicitado para actualizar el stock.",
    )


def update_inventory_photo(codigo_vino: str, object_name: str):
    _update_inventory_cell(
        codigo_vino,
        "foto_url",
        object_name,
        "No se encontró el vino solicitado para guardar la foto.",
    )


def append_cata_record(row: Dict[str, Any]):
    worksheet = get_catas_worksheet()
    worksheet.append_row([row.get(header, "") for header in CATAS_HEADERS])
