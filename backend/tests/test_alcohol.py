"""La graduacion se teclea con coma pero se guarda con punto.

El Sheet de produccion ya tiene "12,5" mezclado entre once valores con punto:
dos formas del mismo dato no se ordenan ni se comparan.
"""

import pytest

from app.schemas.wine_schema import (
    WineCreateInput,
    WineRecord,
    WineScanResult,
    WineUpdateInput,
    normalize_alcohol,
)


@pytest.mark.parametrize(
    "entrada,esperado",
    [
        ("12,5", "12.5"),  # el caso real de produccion
        ("14.2", "14.2"),
        ("14", "14"),
        ("14%", "14"),  # el simbolo no es parte del dato
        (" 13,5 % ", "13.5"),
        ("14.0", "14"),  # sin decimales sobrantes
        ("13,50", "13.5"),
    ],
)
def test_normaliza_a_punto(entrada, esperado):
    assert normalize_alcohol(entrada) == esperado


@pytest.mark.parametrize("entrada", ["sin dato", "abv 13", "1.234.5"])
def test_deja_pasar_lo_que_no_es_numero(entrada):
    # Texto libre: una fila vieja del Sheet no tiene por que romperse.
    assert normalize_alcohol(entrada) == entrada


def test_vacio_es_none():
    assert normalize_alcohol("") is None
    assert normalize_alcohol(None) is None


def wine_payload(alcohol):
    return dict(
        bodega="Trapiche",
        nombre_vino="Fond de Cave",
        varietal="Malbec",
        anada=2020,
        region="Mendoza",
        alcohol=alcohol,
    )


def test_al_crear_la_coma_se_guarda_como_punto():
    assert WineCreateInput(**wine_payload("13,5")).alcohol == "13.5"


def test_al_editar_la_coma_se_guarda_como_punto():
    assert WineUpdateInput(**wine_payload("13,5")).alcohol == "13.5"


def test_al_crear_el_alcohol_sigue_siendo_obligatorio():
    with pytest.raises(ValueError):
        WineCreateInput(**wine_payload("  "))


def test_lo_que_lee_gemini_tambien_se_normaliza():
    assert WineScanResult(alcohol="13,5%").alcohol == "13.5"


def test_una_fila_vieja_del_sheet_se_empareja_al_leer():
    # Sin esto la app muestra "12,5" al lado de "14.2" y parecen datos distintos.
    record = WineRecord(
        id="uuid",
        codigo_vino="TRA-MAL-2020-0001",
        fecha_ingreso="2026-01-01T10:00:00",
        cantidad=1,
        **wine_payload("12,5"),
    )
    assert record.alcohol == "12.5"
