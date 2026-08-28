import pytest
from pydantic import ValidationError

from app.schemas.wine_schema import WineConsumeInput, WineCreateInput, WineScanResult


def valid_wine_data():
    return {
        "bodega": "  Trapiche ",
        "nombre_vino": " Fond de Cave ",
        "varietal": " Malbec ",
        "anada": 2020,
        "region": " Mendoza ",
        "alcohol": " 14% ",
    }


def test_scan_result_normalizes_text_and_keeps_missing_values():
    result = WineScanResult(**{**valid_wine_data(), "anada": None})

    assert result.bodega == "Trapiche"
    assert result.nombre_vino == "Fond de Cave"
    # El simbolo no es parte del dato: se guarda el numero solo (ver test_alcohol).
    assert result.alcohol == "14"
    assert result.anada is None


@pytest.mark.parametrize(
    "field,value",
    [
        ("bodega", "   "),
        ("nombre_vino", ""),
        ("varietal", "   "),
        ("region", ""),
        ("alcohol", "   "),
    ],
)
def test_create_input_rejects_empty_required_text(field, value):
    data = valid_wine_data()
    data[field] = value

    with pytest.raises(ValidationError):
        WineCreateInput(**data)


@pytest.mark.parametrize(
    "field,value",
    [("anada", 1899), ("anada", 2100), ("cantidad", -1)],
)
def test_create_input_rejects_invalid_numeric_values(field, value):
    data = valid_wine_data()
    data[field] = value

    with pytest.raises(ValidationError):
        WineCreateInput(**data)


@pytest.mark.parametrize("score", [0, 6])
def test_consume_input_rejects_score_outside_range(score):
    with pytest.raises(ValidationError):
        WineConsumeInput(puntuacion=score)


def test_client_cannot_set_system_dates():
    with pytest.raises(ValidationError):
        WineCreateInput(**{**valid_wine_data(), "fecha_ingreso": "2020-01-01"})

    with pytest.raises(ValidationError):
        WineConsumeInput(puntuacion=4, fecha_consumo="2020-01-01")