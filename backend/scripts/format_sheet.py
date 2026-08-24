"""Da formato visual a la planilla: encabezados, filtros, colores y validaciones.

Es idempotente: se puede correr las veces que haga falta. No toca los datos,
solo el formato y las reglas de validacion.

Por defecto usa la planilla de GOOGLE_SHEET_NAME (la de DEV, segun .env).
Para dar formato a otra:

    python backend/scripts/format_sheet.py
    python backend/scripts/format_sheet.py Mi_Cava_Virtual
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Debe fijarse antes de importar el servicio, que lee la config al cargarse.
if len(sys.argv) > 1:
    os.environ["GOOGLE_SHEET_NAME"] = sys.argv[1]

from app.services.sheets_service import (  # noqa: E402
    CATAS_HEADERS,
    CATAS_TAB,
    INVENTORY_HEADERS,
    INVENTORY_TAB,
    get_spreadsheet,
)

# Paleta pergamino, la misma de la app.
VINO = {"red": 0.486, "green": 0.137, "blue": 0.220}       # #7c2338
PAPEL = {"red": 0.984, "green": 0.969, "blue": 0.937}      # #fbf7ef
PAPEL_ALT = {"red": 0.949, "green": 0.925, "blue": 0.882}  # #f2ece1
CREMA = {"red": 0.969, "green": 0.949, "blue": 0.910}
BORDE = {"red": 0.867, "green": 0.824, "blue": 0.745}      # #ddd2be
VERDE = {"red": 0.361, "green": 0.439, "blue": 0.282}      # #5c7048
TINTA = {"red": 0.169, "green": 0.129, "blue": 0.098}      # #2b2119

# Anchos por columna: los ids tecnicos se achican, el texto respira.
INVENTORY_WIDTHS = {
    "id": 60,
    "fecha_ingreso": 145,
    "bodega": 130,
    "nombre_vino": 180,
    "varietal": 130,
    "anada": 70,
    "region": 140,
    "alcohol": 75,
    "cantidad": 80,
    "ubicacion": 90,
    "precio_estimado": 110,
    "foto_url": 90,
    "codigo_vino": 165,
}

CATAS_WIDTHS = {
    "id_cata": 60,
    "vino_id": 165,
    "fecha_consumo": 145,
    "puntuacion": 90,
    "notas_cata": 320,
    "maridaje": 180,
}

VARIETALES = [
    "Malbec", "Cabernet Sauvignon", "Cabernet Franc", "Merlot", "Syrah",
    "Pinot Noir", "Bonarda", "Tempranillo", "Tannat", "Petit Verdot",
    "Blend", "Chardonnay", "Sauvignon Blanc", "Torrontes", "Viognier",
    "Semillon", "Riesling", "Pinot Gris", "Rose", "Espumante",
]


def _text(color, bold=False, size=10, italic=False):
    return {
        "foregroundColor": color,
        "fontFamily": "Karla",
        "fontSize": size,
        "bold": bold,
        "italic": italic,
    }


def _header_requests(sheet_id: str, headers: list[str], widths: dict[str, int]):
    """Encabezado en vino, congelado, con filtros."""
    last_col = len(headers)
    return [
        # Encabezado: fondo vino, texto crema.
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": last_col,
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": VINO,
                        "textFormat": _text(CREMA, bold=True, size=10),
                        "horizontalAlignment": "LEFT",
                        "verticalAlignment": "MIDDLE",
                        "padding": {"top": 6, "bottom": 6, "left": 10, "right": 10},
                    }
                },
                "fields": "userEnteredFormat",
            }
        },
        # Fila 1 congelada: el encabezado queda visible al scrollear.
        {
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {"frozenRowCount": 1, "rowCount": 1000},
                },
                "fields": "gridProperties.frozenRowCount,gridProperties.rowCount",
            }
        },
        # Alto del encabezado.
        {
            "updateDimensionProperties": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "ROWS",
                    "startIndex": 0,
                    "endIndex": 1,
                },
                "properties": {"pixelSize": 34},
                "fields": "pixelSize",
            }
        },
        # Cuerpo: tipografia y fondo papel.
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": last_col,
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": PAPEL,
                        "textFormat": _text(TINTA),
                        "verticalAlignment": "MIDDLE",
                        "padding": {"top": 4, "bottom": 4, "left": 10, "right": 10},
                    }
                },
                "fields": "userEnteredFormat",
            }
        },
        # Filtros en el encabezado.
        {
            "setBasicFilter": {
                "filter": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 0,
                        "startColumnIndex": 0,
                        "endColumnIndex": last_col,
                    }
                }
            }
        },
    ] + [
        {
            "updateDimensionProperties": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": headers.index(name),
                    "endIndex": headers.index(name) + 1,
                },
                "properties": {"pixelSize": width},
                "fields": "pixelSize",
            }
        }
        for name, width in widths.items()
        if name in headers
    ]


def _banding_request(sheet_id: str, last_col: int):
    """Filas alternadas, para seguir la linea con la vista."""
    return {
        "addBanding": {
            "bandedRange": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": last_col,
                },
                "rowProperties": {
                    "firstBandColor": PAPEL,
                    "secondBandColor": PAPEL_ALT,
                },
            }
        }
    }


def _column(headers: list[str], name: str) -> int:
    return headers.index(name)


def _inventory_extras(sheet_id: str):
    col = lambda name: _column(INVENTORY_HEADERS, name)  # noqa: E731
    body = {"sheetId": sheet_id, "startRowIndex": 1}

    return [
        # Desplegable de varietal.
        {
            "setDataValidation": {
                "range": {**body, "startColumnIndex": col("varietal"),
                          "endColumnIndex": col("varietal") + 1},
                "rule": {
                    "condition": {
                        "type": "ONE_OF_LIST",
                        "values": [{"userEnteredValue": v} for v in VARIETALES],
                    },
                    # Sin strict: la app puede escribir lo que lea Gemini.
                    "strict": False,
                    "showCustomUi": True,
                },
            }
        },
        # Cantidad: entero >= 0.
        {
            "setDataValidation": {
                "range": {**body, "startColumnIndex": col("cantidad"),
                          "endColumnIndex": col("cantidad") + 1},
                "rule": {
                    "condition": {
                        "type": "NUMBER_GREATER_THAN_EQ",
                        "values": [{"userEnteredValue": "0"}],
                    },
                    "inputMessage": "Cantidad de botellas (0 o mas).",
                    "strict": False,
                },
            }
        },
        # Anada: 1900 al 2100.
        {
            "setDataValidation": {
                "range": {**body, "startColumnIndex": col("anada"),
                          "endColumnIndex": col("anada") + 1},
                "rule": {
                    "condition": {
                        "type": "NUMBER_BETWEEN",
                        "values": [
                            {"userEnteredValue": "1900"},
                            {"userEnteredValue": "2100"},
                        ],
                    },
                    "inputMessage": "Anada entre 1900 y 2100.",
                    "strict": False,
                },
            }
        },
        # Precio con formato moneda.
        {
            "repeatCell": {
                "range": {**body, "startColumnIndex": col("precio_estimado"),
                          "endColumnIndex": col("precio_estimado") + 1},
                "cell": {
                    "userEnteredFormat": {
                        "numberFormat": {"type": "CURRENCY", "pattern": '"$"#,##0'}
                    }
                },
                "fields": "userEnteredFormat.numberFormat",
            }
        },
        # Cantidad, anada y codigo centrados.
        *[
            {
                "repeatCell": {
                    "range": {**body, "startColumnIndex": col(name),
                              "endColumnIndex": col(name) + 1},
                    "cell": {"userEnteredFormat": {"horizontalAlignment": "CENTER"}},
                    "fields": "userEnteredFormat.horizontalAlignment",
                }
            }
            for name in ("anada", "cantidad", "ubicacion")
        ],
        # Codigo en monoespaciada.
        {
            "repeatCell": {
                "range": {**body, "startColumnIndex": col("codigo_vino"),
                          "endColumnIndex": col("codigo_vino") + 1},
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {
                            "fontFamily": "Roboto Mono",
                            "fontSize": 9,
                            "foregroundColor": VINO,
                            "bold": True,
                        }
                    }
                },
                "fields": "userEnteredFormat.textFormat",
            }
        },
        # El id tecnico y la foto se atenuan: no son para leer.
        *[
            {
                "repeatCell": {
                    "range": {**body, "startColumnIndex": col(name),
                              "endColumnIndex": col(name) + 1},
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {
                                "fontFamily": "Karla",
                                "fontSize": 8,
                                "foregroundColor": {"red": 0.64, "green": 0.57, "blue": 0.48},
                            }
                        }
                    },
                    "fields": "userEnteredFormat.textFormat",
                }
            }
            for name in ("id", "foto_url")
        ],
        # Sin stock: la fila se apaga.
        {
            "addConditionalFormatRule": {
                "index": 0,
                "rule": {
                    "ranges": [{**body, "startColumnIndex": 0,
                                "endColumnIndex": len(INVENTORY_HEADERS)}],
                    "booleanRule": {
                        "condition": {
                            "type": "CUSTOM_FORMULA",
                            "values": [{"userEnteredValue": "=$I2=0"}],
                        },
                        "format": {
                            "backgroundColor": {"red": 0.93, "green": 0.91, "blue": 0.87},
                            "textFormat": {
                                "foregroundColor": {"red": 0.60, "green": 0.55, "blue": 0.47},
                                "italic": True,
                            },
                        },
                    },
                },
            }
        },
        # Ultima botella: se marca en vino.
        {
            "addConditionalFormatRule": {
                "index": 0,
                "rule": {
                    "ranges": [{**body, "startColumnIndex": col("cantidad"),
                                "endColumnIndex": col("cantidad") + 1}],
                    "booleanRule": {
                        "condition": {
                            "type": "NUMBER_EQ",
                            "values": [{"userEnteredValue": "1"}],
                        },
                        "format": {
                            "textFormat": {"foregroundColor": VINO, "bold": True}
                        },
                    },
                },
            }
        },
    ]


def _catas_extras(sheet_id: str):
    col = lambda name: _column(CATAS_HEADERS, name)  # noqa: E731
    body = {"sheetId": sheet_id, "startRowIndex": 1}

    return [
        # Puntuacion 1 a 5.
        {
            "setDataValidation": {
                "range": {**body, "startColumnIndex": col("puntuacion"),
                          "endColumnIndex": col("puntuacion") + 1},
                "rule": {
                    "condition": {
                        "type": "ONE_OF_LIST",
                        "values": [{"userEnteredValue": str(n)} for n in range(1, 6)],
                    },
                    "strict": False,
                    "showCustomUi": True,
                },
            }
        },
        {
            "repeatCell": {
                "range": {**body, "startColumnIndex": col("puntuacion"),
                          "endColumnIndex": col("puntuacion") + 1},
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": "CENTER",
                        "textFormat": {"bold": True, "foregroundColor": VINO},
                    }
                },
                "fields": "userEnteredFormat(horizontalAlignment,textFormat)",
            }
        },
        # Las notas envuelven, que es donde vive el texto largo.
        {
            "repeatCell": {
                "range": {**body, "startColumnIndex": col("notas_cata"),
                          "endColumnIndex": col("notas_cata") + 1},
                "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP"}},
                "fields": "userEnteredFormat.wrapStrategy",
            }
        },
        # Maridaje en verde vid.
        {
            "repeatCell": {
                "range": {**body, "startColumnIndex": col("maridaje"),
                          "endColumnIndex": col("maridaje") + 1},
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"foregroundColor": VERDE, "italic": True}
                    }
                },
                "fields": "userEnteredFormat.textFormat",
            }
        },
        # 5 puntos: se destaca en verde.
        {
            "addConditionalFormatRule": {
                "index": 0,
                "rule": {
                    "ranges": [{**body, "startColumnIndex": col("puntuacion"),
                                "endColumnIndex": col("puntuacion") + 1}],
                    "booleanRule": {
                        "condition": {
                            "type": "NUMBER_EQ",
                            "values": [{"userEnteredValue": "5"}],
                        },
                        "format": {
                            "backgroundColor": {"red": 0.85, "green": 0.89, "blue": 0.80},
                            "textFormat": {"foregroundColor": VERDE, "bold": True},
                        },
                    },
                },
            }
        },
        {
            "repeatCell": {
                "range": {**body, "startColumnIndex": col("id_cata"),
                          "endColumnIndex": col("id_cata") + 1},
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {
                            "fontFamily": "Karla",
                            "fontSize": 8,
                            "foregroundColor": {"red": 0.64, "green": 0.57, "blue": 0.48},
                        }
                    }
                },
                "fields": "userEnteredFormat.textFormat",
            }
        },
        {
            "repeatCell": {
                "range": {**body, "startColumnIndex": col("vino_id"),
                          "endColumnIndex": col("vino_id") + 1},
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {
                            "fontFamily": "Roboto Mono",
                            "fontSize": 9,
                            "foregroundColor": VINO,
                            "bold": True,
                        }
                    }
                },
                "fields": "userEnteredFormat.textFormat",
            }
        },
    ]


def _clear_existing(spreadsheet, sheet_id: str, last_col: int):
    """Quita bandas y reglas previas para que el script sea idempotente."""
    requests = []
    meta = spreadsheet.fetch_sheet_metadata()
    for sheet in meta.get("sheets", []):
        if sheet["properties"]["sheetId"] != sheet_id:
            continue
        for banding in sheet.get("bandedRanges", []):
            requests.append({"deleteBanding": {"bandedRangeId": banding["bandedRangeId"]}})
        # Se borran de atras para adelante: los indices se corren al eliminar.
        for index in reversed(range(len(sheet.get("conditionalFormats", [])))):
            requests.append(
                {"deleteConditionalFormatRule": {"index": index, "sheetId": sheet_id}}
            )
    return requests


def main() -> int:
    spreadsheet = get_spreadsheet()
    print(f"Planilla: {spreadsheet.title}")

    tabs = [
        (INVENTORY_TAB, INVENTORY_HEADERS, INVENTORY_WIDTHS, _inventory_extras),
        (CATAS_TAB, CATAS_HEADERS, CATAS_WIDTHS, _catas_extras),
    ]

    for title, headers, widths, extras in tabs:
        try:
            worksheet = spreadsheet.worksheet(title)
        except Exception:
            print(f"  {title}: no existe, se omite")
            continue

        sheet_id = worksheet.id
        requests = _clear_existing(spreadsheet, sheet_id, len(headers))
        requests += _header_requests(sheet_id, headers, widths)
        requests.append(_banding_request(sheet_id, len(headers)))
        requests += extras(sheet_id)

        spreadsheet.batch_update({"requests": requests})
        print(f"  {title}: {len(requests)} ajustes aplicados")

    print("\nListo. La planilla quedo con encabezado fijo, filtros, franjas,")
    print("desplegables de varietal y puntuacion, y colores de la app.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
