"""Rellena codigo_vino en filas del inventario que lo tengan vacío o en formato legacy.

Migración de un solo uso: correr manualmente, no forma parte del flujo de la API.
    python scripts/backfill_wine_codes.py
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.services.sheets_service import get_inventory_worksheet  # noqa: E402
from app.utils.wine_code import build_wine_code, extract_sequence  # noqa: E402


def main() -> None:
    worksheet = get_inventory_worksheet()
    rows = worksheet.get_all_values()
    if len(rows) <= 1:
        print("Inventario vacío, nada que hacer.")
        return

    headers = rows[0]
    code_index = headers.index("codigo_vino")
    bodega_index = headers.index("bodega")
    varietal_index = headers.index("varietal")
    anada_index = headers.index("anada")

    counters: dict[tuple[str, str, str], int] = {}
    pending = []

    for row_number, row in enumerate(rows[1:], start=2):
        if not any(cell for cell in row):
            continue

        def cell(index: int) -> str:
            return row[index] if index < len(row) else ""

        bodega, varietal, anada = cell(bodega_index), cell(varietal_index), cell(anada_index)
        key = (bodega, varietal, str(anada))
        existing = cell(code_index)

        sequence = extract_sequence(existing, bodega=bodega, varietal=varietal, anada=anada)
        if sequence is not None:
            counters[key] = max(counters.get(key, 0), sequence)
            continue

        counters[key] = counters.get(key, 0) + 1
        pending.append((row_number, build_wine_code(
            bodega=bodega, varietal=varietal, anada=anada, sequence=counters[key],
        )))

    if not pending:
        print("Todos los vinos ya tienen un código válido.")
        return

    worksheet.batch_update([
        {"range": f"{chr(ord('A') + code_index)}{row_number}", "values": [[code]]}
        for row_number, code in pending
    ])
    for row_number, code in pending:
        print(f"Fila {row_number}: {code}")
    print(f"{len(pending)} código(s) asignado(s).")


if __name__ == "__main__":
    main()
