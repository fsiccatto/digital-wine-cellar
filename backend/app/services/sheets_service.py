import logging
import os
import time
from typing import Any, Dict, List

import gspread
from gspread.utils import rowcol_to_a1

from app.config import GOOGLE_SHEETS_CREDENTIALS_FILE, GOOGLE_SHEET_NAME

logger = logging.getLogger(__name__)

# La API de Sheets devuelve 503 de vez en cuando sin que pase nada raro, y sin
# reintento eso le llega al usuario como un 500. Tambien 429 cuando se pasa de
# cuota, que se destraba esperando.
TRANSIENT_CODES = {429, 500, 502, 503, 504}
RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY = 0.5


def _retry(operacion, *args, **kwargs):
    """Reintenta una operacion IDEMPOTENTE ante un error pasajero de Google.

    Solo para lecturas y para escrituras que fijan un valor concreto: repetir
    esas deja el Sheet igual. `append_row` no entra aca a proposito — un 503
    puede llegar con la fila ya escrita, y reintentar la duplicaria.
    """
    for intento in range(1, RETRY_ATTEMPTS + 1):
        try:
            return operacion(*args, **kwargs)
        except gspread.exceptions.APIError as exc:
            if exc.code not in TRANSIENT_CODES or intento == RETRY_ATTEMPTS:
                raise
            espera = RETRY_BASE_DELAY * (2 ** (intento - 1))
            logger.warning(
                "Sheets devolvio %s (intento %s/%s), reintento en %.1fs",
                exc.code, intento, RETRY_ATTEMPTS, espera,
            )
            time.sleep(espera)

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

# Nota sobre inyeccion de formulas: gspread 6.x escribe con value_input_option
# RAW por default, asi que un valor que arranque con "=" se guarda como texto y
# no como formula. Por eso NO se escapan los campos de texto libre. Verificado
# contra el Sheet real; si alguna vez se pasa USER_ENTERED explicito o se baja
# de version, esto deja de ser cierto y hay que revisarlo.

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
    _spreadsheet = _retry(gc.open, GOOGLE_SHEET_NAME)
    return _spreadsheet


def _get_worksheet(title: str, headers: List[str]):
    """Resolve a worksheet once per process, creating the tab and header row if absent."""
    if title in _worksheets:
        return _worksheets[title]

    spreadsheet = get_spreadsheet()
    try:
        worksheet = _retry(spreadsheet.worksheet, title)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=title, rows=100, cols=len(headers))
        worksheet.append_row(headers)
        _worksheets[title] = worksheet
        return worksheet

    first_row = _retry(worksheet.row_values, 1)
    if not first_row:
        worksheet.append_row(headers)
    elif first_row != headers:
        # La fila 1 ya es un encabezado (posiblemente de un esquema anterior):
        # se reescribe en lugar de insertar, para no duplicarla en cada arranque.
        if worksheet.col_count < len(headers):
            worksheet.add_cols(len(headers) - worksheet.col_count)
        _retry(worksheet.update, [headers], f"A1:{rowcol_to_a1(1, len(headers))}")

    _worksheets[title] = worksheet
    return worksheet


def get_inventory_worksheet():
    return _get_worksheet(INVENTORY_TAB, INVENTORY_HEADERS)


def get_catas_worksheet():
    return _get_worksheet(CATAS_TAB, CATAS_HEADERS)


def _rows_from(worksheet) -> List[Dict[str, Any]]:
    """Lee una pestaña completa como dicts, salteando las filas vacías."""
    values = _retry(worksheet.get_all_values)
    if len(values) <= 1:
        return []

    headers = values[0]
    rows = []
    for row in values[1:]:
        if not any(cell for cell in row):
            continue
        rows.append({header: row[i] if i < len(row) else "" for i, header in enumerate(headers)})
    return rows


def get_inventory_rows() -> List[Dict[str, Any]]:
    return _rows_from(get_inventory_worksheet())


def get_catas_rows() -> List[Dict[str, Any]]:
    return _rows_from(get_catas_worksheet())


def append_inventory_row(row: Dict[str, Any]):
    worksheet = get_inventory_worksheet()
    # Sin _retry a proposito: un 503 puede llegar con la fila ya agregada, y el
    # reintento cargaria el vino dos veces.
    worksheet.append_row([row.get(header, "") for header in INVENTORY_HEADERS])


def _find_row_number(values: List[List[str]], key_column: str, key: str) -> int:
    """Número de fila 1-based de la primera coincidencia, o 0 si no está.

    La fila 1 es el encabezado, así que las filas de datos arrancan en 2.
    """
    key_index = values[0].index(key_column)
    for row_number, row in enumerate(values[1:], start=2):
        if len(row) > key_index and row[key_index] == key:
            return row_number
    return 0


def _update_inventory_cell(codigo_vino: str, column: str, value: Any, missing: str):
    worksheet = get_inventory_worksheet()
    rows = _retry(worksheet.get_all_values)
    if len(rows) <= 1:
        raise ValueError("El inventario está vacío.")

    row_number = _find_row_number(rows, "codigo_vino", codigo_vino)
    if not row_number:
        raise ValueError(missing)

    _retry(worksheet.update_cell, row_number, rows[0].index(column) + 1, value)


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


def _update_row(worksheet, key_column: str, key: str, row: Dict[str, Any], missing: str):
    """Fusiona `row` sobre la fila existente y la escribe de una sola vez.

    Una escritura por celda gastaría una llamada por campo contra el límite de
    60/min del free tier; editar un vino son 8 campos. Y la fusión va acá adentro
    para que una escritura de fila nunca borre las columnas que el payload no
    trae (`id`, `fecha_ingreso`, `foto_url`, `codigo_vino`, `cantidad`).
    """
    values = _retry(worksheet.get_all_values)
    if len(values) <= 1:
        raise ValueError(missing)

    row_number = _find_row_number(values, key_column, key)
    if not row_number:
        raise ValueError(missing)

    headers = values[0]
    current = values[row_number - 1]
    merged = []
    for index, header in enumerate(headers):
        if header in row:
            value = row[header]
            merged.append("" if value is None else value)
        else:
            merged.append(current[index] if index < len(current) else "")

    _retry(
        worksheet.update,
        [merged],
        f"A{row_number}:{rowcol_to_a1(row_number, len(headers))}",
    )


def _delete_row(worksheet, key_column: str, key: str, missing: str):
    values = _retry(worksheet.get_all_values)
    if len(values) <= 1:
        raise ValueError(missing)

    row_number = _find_row_number(values, key_column, key)
    if not row_number:
        raise ValueError(missing)

    # Sin _retry a proposito: al borrar, las filas de abajo suben. Si el 503
    # llega con el borrado hecho, el reintento se lleva puesta la fila
    # siguiente, que no tiene nada que ver.
    worksheet.delete_rows(row_number)


def update_inventory_row(codigo_vino: str, row: Dict[str, Any]):
    _update_row(
        get_inventory_worksheet(),
        "codigo_vino",
        codigo_vino,
        row,
        "No se encontró el vino solicitado para actualizar.",
    )


def delete_inventory_row(codigo_vino: str):
    _delete_row(
        get_inventory_worksheet(),
        "codigo_vino",
        codigo_vino,
        "No se encontró el vino solicitado para eliminar.",
    )


def append_cata_record(row: Dict[str, Any]):
    worksheet = get_catas_worksheet()
    worksheet.append_row([row.get(header, "") for header in CATAS_HEADERS])


def update_cata_row(id_cata: str, row: Dict[str, Any]):
    _update_row(
        get_catas_worksheet(),
        "id_cata",
        id_cata,
        row,
        "No se encontró la cata solicitada para actualizar.",
    )


def delete_cata_row(id_cata: str):
    _delete_row(
        get_catas_worksheet(),
        "id_cata",
        id_cata,
        "No se encontró la cata solicitada para eliminar.",
    )
