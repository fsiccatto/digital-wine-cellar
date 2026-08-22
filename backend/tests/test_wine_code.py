from app.utils.wine_code import build_wine_code


def test_build_wine_code_includes_wine_data_and_suffix():
    code = build_wine_code(
        bodega="Bodégã 123",
        nombre_vino="Gran Reserva",
        varietal="Malbec",
        anada=2021,
        unique_seed="ab12cd34-xxxx",
    )

    assert code == "VINO-BOD-GRA-MAL-2021-AB12"


def test_build_wine_code_handles_missing_values():
    code = build_wine_code(
        bodega="",
        nombre_vino="",
        varietal="",
        anada="",
        unique_seed="",
    )

    assert code == "VINO-XXX-XXX-XXX-0000-0000"