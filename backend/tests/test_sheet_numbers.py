import pytest

from app.schemas.wine_schema import WineRecord, parse_sheet_number


def base_row(**overrides):
    row = {
        "id": "uuid",
        "codigo_vino": "RUT-CAB-2018-0001",
        "fecha_ingreso": "2026-08-24T12:00:00",
        "bodega": "Rutini",
        "nombre_vino": "Gran Cabernet",
        "varietal": "Cabernet Sauvignon",
        "anada": "2018",
        "region": "Tupungato",
        "alcohol": "14.2%",
        "cantidad": "2",
        "ubicacion": "B1",
        "precio_estimado": "",
        "foto_url": "",
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", None),
        ("   ", None),
        (32000, 32000),
        ("32000", 32000),
        # El punto separa miles en es-AR: no son 32 pesos.
        ("$32.000", 32000),
        ("32.000", 32000),
        ("$ 32.000", 32000),
        # Con decimales explicitos.
        ("32.000,50", 32000.5),
        ("1.234,5", 1234.5),
        # Formato en-US.
        ("$32,000.50", 32000.5),
        ("32,000", 32000),
        # Un punto que si es decimal: no son tres digitos.
        ("32.5", 32.5),
        ("-1.500", -1500),
        ("sin precio", None),
    ],
)
def test_parse_sheet_number(raw, expected):
    assert parse_sheet_number(raw) == expected


def test_currency_formatted_row_is_kept():
    # El bug real: dar formato moneda al Sheet hacia desaparecer el vino.
    wine = WineRecord(**base_row(precio_estimado="$32.000"))

    assert wine.precio_estimado == 32000
    assert wine.nombre_vino == "Gran Cabernet"


def test_thousands_separator_in_quantity():
    wine = WineRecord(**base_row(cantidad="1.200"))

    assert wine.cantidad == 1200


def test_blank_price_stays_none():
    assert WineRecord(**base_row()).precio_estimado is None
