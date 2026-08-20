import os

import gspread

from app.config import GOOGLE_SHEETS_CREDENTIALS_FILE, GOOGLE_SHEET_NAME


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
