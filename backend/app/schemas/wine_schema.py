from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

CURRENT_YEAR = datetime.now().year


def normalize_optional_text(value):
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    value = value.strip()
    return value or None


def normalize_required_text(value):
    value = normalize_optional_text(value)
    if value is None:
        raise ValueError("El campo no puede estar vacío.")
    return value


class WineScanResult(BaseModel):
    bodega: Optional[str] = None
    nombre_vino: Optional[str] = None
    varietal: Optional[str] = None
    region: Optional[str] = None
    alcohol: Optional[str] = None

    _normalize_text = field_validator(
        "bodega", "nombre_vino", "varietal", "region", "alcohol", mode="before"
    )(normalize_optional_text)

    anada: Optional[int] = Field(default=None, ge=1900, le=CURRENT_YEAR)


class WineCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bodega: str
    nombre_vino: str
    varietal: str
    anada: int = Field(ge=1900, le=CURRENT_YEAR)
    region: str
    alcohol: str
    cantidad: int = Field(default=1, ge=0)
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None
    # foto_url no se acepta acá: la foto se sube a POST /wines/{codigo}/foto,
    # que es quien escribe el nombre del objeto en el Sheet.

    _normalize_required = field_validator(
        "bodega", "nombre_vino", "varietal", "region", "alcohol", mode="before"
    )(normalize_required_text)


class WineConsumeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    puntuacion: int = Field(ge=1, le=5)
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None


def empty_to_none(value):
    if isinstance(value, str) and not value.strip():
        return None
    return value


def parse_sheet_number(value):
    """Convierte un numero con formato de Sheets ("$32.000", "1.234,5") a float.

    Una celda con formato de moneda o de miles no llega como numero limpio:
    Sheets devuelve el texto que se ve. Sin esto la fila entera se descarta.
    """
    value = empty_to_none(value)
    if not isinstance(value, str):
        return value

    cleaned = "".join(ch for ch in value if ch.isdigit() or ch in ",.-")
    if not cleaned:
        return None

    # Cual de los dos separadores es el decimal: el ultimo que aparece.
    last_comma = cleaned.rfind(",")
    last_dot = cleaned.rfind(".")

    def is_grouping(text: str, sep: str) -> bool:
        """Un separador solo, con tres digitos justos detras, agrupa miles.

        "32.000" son treinta y dos mil, no treinta y dos; lo mismo "32,000".
        """
        head, _, tail = text.rpartition(sep)
        return len(tail) == 3 and sep not in head and head.lstrip("-").isdigit()

    if last_comma >= 0 and last_dot >= 0:
        # Estan los dos: el ultimo es el decimal y el otro agrupa.
        if last_comma > last_dot:
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif last_dot >= 0:
        cleaned = cleaned.replace(".", "") if is_grouping(cleaned, ".") else cleaned
    elif last_comma >= 0:
        cleaned = (
            cleaned.replace(",", "")
            if is_grouping(cleaned, ",")
            else cleaned.replace(",", ".")
        )

    try:
        return float(cleaned)
    except ValueError:
        return None


class WineRecord(BaseModel):
    id: str
    codigo_vino: str
    fecha_ingreso: str
    bodega: str
    nombre_vino: str
    varietal: str
    anada: int
    region: str
    alcohol: str
    cantidad: int
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None
    foto_url: Optional[str] = None

    # El Sheet devuelve las celdas con formato como texto ("$32.000").
    _parse_precio = field_validator("precio_estimado", mode="before")(parse_sheet_number)
    _parse_cantidad = field_validator("cantidad", "anada", mode="before")(
        parse_sheet_number
    )
