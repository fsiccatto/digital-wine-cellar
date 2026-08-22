from app.utils.wine_code import build_wine_code, extract_sequence, next_sequence


def test_build_wine_code_includes_bucket_and_sequence():
    code = build_wine_code(
        bodega="Bodégã 123",
        varietal="Malbec",
        anada=2021,
        sequence=12,
    )

    assert code == "BOD-MAL-2021-0012"


def test_build_wine_code_handles_missing_values():
    code = build_wine_code(
        bodega="",
        varietal="",
        anada="",
        sequence=0,
    )

    assert code == "XXX-XXX-0000-0001"


def test_extract_sequence_reads_matching_code():
    parsed = extract_sequence("TRA-MAL-2020-0007", bodega="Trapiche", varietal="Malbec", anada=2020)
    assert parsed == 7


def test_next_sequence_uses_existing_bucket_rows():
    rows = [
        {"bodega": "Trapiche", "varietal": "Malbec", "anada": "2020", "codigo_vino": "TRA-MAL-2020-0001"},
        {"bodega": "Trapiche", "varietal": "Malbec", "anada": "2020", "codigo_vino": "VINO-OLD-FORMAT"},
        {"bodega": "Trapiche", "varietal": "Cabernet", "anada": "2020", "codigo_vino": "TRA-CAB-2020-0001"},
    ]

    seq = next_sequence(rows, bodega="Trapiche", varietal="Malbec", anada=2020)
    assert seq == 3