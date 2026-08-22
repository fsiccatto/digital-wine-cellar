import re
import unicodedata


def _normalize_token(value: str, length: int = 3) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    compact = re.sub(r"[^A-Za-z0-9]", "", ascii_only).upper()
    if not compact:
        return "X" * length
    return compact[:length].ljust(length, "X")


def _normalize_year(anada: int | str) -> str:
    year = str(anada)
    if not year.isdigit() or len(year) != 4:
        return "0000"
    return year


def build_wine_prefix(bodega: str, varietal: str, anada: int | str) -> str:
    return f"{_normalize_token(bodega)}-{_normalize_token(varietal)}-{_normalize_year(anada)}"


def build_wine_code(bodega: str, varietal: str, anada: int | str, sequence: int) -> str:
    safe_sequence = max(1, int(sequence))
    return f"{build_wine_prefix(bodega, varietal, anada)}-{safe_sequence:04d}"


def extract_sequence(code: str, bodega: str, varietal: str, anada: int | str) -> int | None:
    prefix = build_wine_prefix(bodega, varietal, anada)
    if not code or not code.startswith(prefix + "-"):
        return None

    suffix = code[len(prefix) + 1 :]
    if not re.fullmatch(r"\d{4}", suffix):
        return None

    return int(suffix)


def next_sequence(rows: list[dict], bodega: str, varietal: str, anada: int | str) -> int:
    max_existing_sequence = 0
    same_bucket_count = 0
    target_prefix = build_wine_prefix(bodega, varietal, anada)

    for row in rows:
        if build_wine_prefix(row.get("bodega", ""), row.get("varietal", ""), row.get("anada", "")) != target_prefix:
            continue

        same_bucket_count += 1
        parsed_sequence = extract_sequence(
            code=row.get("codigo_vino", ""),
            bodega=bodega,
            varietal=varietal,
            anada=anada,
        )
        if parsed_sequence is not None:
            max_existing_sequence = max(max_existing_sequence, parsed_sequence)

    return max(max_existing_sequence, same_bucket_count) + 1
