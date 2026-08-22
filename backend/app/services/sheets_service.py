import os
from typing import Any, Dict, List

import gspread

from app.config import GOOGLE_SHEETS_CREDENTIALS_FILE, GOOGLE_SHEET_NAME
from app.utils.wine_code import build_wine_code, extract_sequence

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

LEGACY_INVENTORY_HEADERS = [header for header in INVENTORY_HEADERS if header != "codigo_vino"]

CATAS_HEADERS = [
    "id_cata",
    "vino_id",
    "fecha_consumo",
    "puntuacion",
    "notas_cata",
    "maridaje",
]


def get_spreadsheet():
    if not os.path.exists(GOOGLE_SHEETS_CREDENTIALS_FILE):
        raise FileNotFoundError(
            f"No se encontró el archivo de credenciales: {GOOGLE_SHEETS_CREDENTIALS_FILE}. "
            "Copia el JSON del Service Account y colócalo en backend/credentials.json."
        )

    gc = gspread.service_account(filename=GOOGLE_SHEETS_CREDENTIALS_FILE)
    return gc.open(GOOGLE_SHEET_NAME)


def ensure_required_tabs():
    spreadsheet = get_spreadsheet()
    expected_tabs = ["Inventario", "Historico_Catas"]

    existing = {worksheet.title for worksheet in spreadsheet.worksheets()}
    for tab_name in expected_tabs:
        if tab_name not in existing:
            spreadsheet.add_worksheet(title=tab_name, rows="100", cols="20")

    return spreadsheet


def get_inventory_worksheet():
    spreadsheet = ensure_required_tabs()
    worksheet = spreadsheet.worksheet("Inventario")

    if not worksheet.get_all_values():
        worksheet.append_row(INVENTORY_HEADERS)
    else:
        headers = worksheet.row_values(1)
        if headers == LEGACY_INVENTORY_HEADERS:
            if worksheet.col_count < len(INVENTORY_HEADERS):
                worksheet.add_cols(len(INVENTORY_HEADERS) - worksheet.col_count)
            worksheet.update_cell(1, len(INVENTORY_HEADERS), "codigo_vino")
            _backfill_sequential_codes(worksheet)
        elif headers != INVENTORY_HEADERS:
            worksheet.insert_row(INVENTORY_HEADERS, 1)
        else:
            _migrate_old_code_format_if_needed(worksheet)

    return worksheet


def get_catas_worksheet():
    spreadsheet = ensure_required_tabs()
    worksheet = spreadsheet.worksheet("Historico_Catas")

    if not worksheet.get_all_values():
        worksheet.append_row(CATAS_HEADERS)
    else:
        headers = worksheet.row_values(1)
        if headers != CATAS_HEADERS:
            current = worksheet.get_all_values()
            if not current or current[0] != CATAS_HEADERS:
                worksheet.insert_row(CATAS_HEADERS, 1)

    return worksheet


def get_inventory_rows() -> List[Dict[str, Any]]:
    worksheet = get_inventory_worksheet()
    values = worksheet.get_all_values()
    if len(values) <= 1:
        return []

    headers = values[0]
    results = []
    for row in values[1:]:
        if not row or all(not cell for cell in row):
            continue
        entry = {header: row[index] if index < len(row) else "" for index, header in enumerate(headers)}
        results.append(entry)
    return results


def append_inventory_row(row: Dict[str, Any]):
    worksheet = get_inventory_worksheet()
    worksheet.append_row([
        row.get("id", ""),
        row.get("fecha_ingreso", ""),
        row.get("bodega", ""),
        row.get("nombre_vino", ""),
        row.get("varietal", ""),
        row.get("anada", ""),
        row.get("region", ""),
        row.get("alcohol", ""),
        row.get("cantidad", ""),
        row.get("ubicacion", ""),
        row.get("precio_estimado", ""),
        row.get("foto_url", ""),
        row.get("codigo_vino", ""),
    ])


def update_inventory_quantity(codigo_vino: str, quantity: int):
    worksheet = get_inventory_worksheet()
    rows = worksheet.get_all_values()
    if len(rows) <= 1:
        raise ValueError("El inventario está vacío.")

    headers = rows[0]
    quantity_index = headers.index("cantidad") + 1
    code_index = headers.index("codigo_vino")

    for row_index, row in enumerate(rows[1:], start=2):
        if row and len(row) > code_index and row[code_index] == codigo_vino:
            worksheet.update_cell(row_index, quantity_index, quantity)
            return

    raise ValueError("No se encontró el vino solicitado para actualizar el stock.")


def append_cata_record(row: Dict[str, Any]):
    worksheet = get_catas_worksheet()
    worksheet.append_row([
        row.get("id_cata", ""),
        row.get("vino_id", ""),
        row.get("fecha_consumo", ""),
        row.get("puntuacion", ""),
        row.get("notas_cata", ""),
        row.get("maridaje", ""),
    ])


def _backfill_sequential_codes(worksheet):
    counters: Dict[tuple[str, str, str], int] = {}
    rows = worksheet.get_all_values()
    code_column = len(INVENTORY_HEADERS)

    for row_index, row in enumerate(rows[1:], start=2):
        if not row:
            continue

        bodega = row[2] if len(row) > 2 else ""
        varietal = row[4] if len(row) > 4 else ""
        anada = row[5] if len(row) > 5 else ""

        key = (bodega, varietal, str(anada))
        counters[key] = counters.get(key, 0) + 1

        code = build_wine_code(
            bodega=bodega,
            varietal=varietal,
            anada=anada,
            sequence=counters[key],
        )
        worksheet.update_cell(row_index, code_column, code)


def _migrate_old_code_format_if_needed(worksheet):
    rows = worksheet.get_all_values()
    if len(rows) <= 1:
        return

    headers = rows[0]
    code_index = headers.index("codigo_vino")

    needs_migration = False
    for row in rows[1:]:
        if not row or len(row) <= code_index:
            continue
        code = row[code_index]
        if code.startswith("VINO-"):
            needs_migration = True
            break

    if not needs_migration:
        return

    counters: Dict[tuple[str, str, str], int] = {}
    for row_index, row in enumerate(rows[1:], start=2):
        if not row:
            continue

        bodega = row[2] if len(row) > 2 else ""
        varietal = row[4] if len(row) > 4 else ""
        anada = row[5] if len(row) > 5 else ""
        current_code = row[code_index] if len(row) > code_index else ""

        key = (bodega, varietal, str(anada))
        parsed = extract_sequence(current_code, bodega=bodega, varietal=varietal, anada=anada)
        if parsed is not None:
            counters[key] = max(counters.get(key, 0), parsed)
            continue

        counters[key] = counters.get(key, 0) + 1
        code = build_wine_code(
            bodega=bodega,
            varietal=varietal,
            anada=anada,
            sequence=counters[key],
        )
        worksheet.update_cell(row_index, code_index + 1, code)
