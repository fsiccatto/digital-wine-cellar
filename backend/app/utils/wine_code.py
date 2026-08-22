import re
import unicodedata


def _normalize_token(value: str, length: int = 3) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    compact = re.sub(r"[^A-Za-z0-9]", "", ascii_only).upper()
    if not compact:
        return "X" * length
    return compact[:length].ljust(length, "X")


def build_wine_code(
    bodega: str,
    nombre_vino: str,
    varietal: str,
    anada: int | str,
    unique_seed: str,
) -> str:
    year = str(anada)
    if not year.isdigit() or len(year) != 4:
        year = "0000"

    suffix = re.sub(r"[^A-Za-z0-9]", "", unique_seed or "").upper()[:4].ljust(4, "0")

    return (
        f"VINO-{_normalize_token(bodega)}-{_normalize_token(nombre_vino)}-"
        f"{_normalize_token(varietal)}-{year}-{suffix}"
    )
