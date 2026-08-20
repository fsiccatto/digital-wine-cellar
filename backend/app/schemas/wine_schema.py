from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

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
    fecha_ingreso: Optional[str] = None
    bodega: str
    nombre_vino: str
    varietal: str
    anada: int = Field(ge=1900, le=CURRENT_YEAR)
    region: str
    alcohol: str
    cantidad: int = Field(default=1, ge=0)
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None
    foto_url: Optional[str] = None

    _normalize_required = field_validator(
        "bodega", "nombre_vino", "varietal", "region", "alcohol", mode="before"
    )(normalize_required_text)


class WineConsumeInput(BaseModel):
    fecha_consumo: Optional[str] = None
    puntuacion: int = Field(ge=1, le=5)
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None


class WineRecord(BaseModel):
    id: str
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
