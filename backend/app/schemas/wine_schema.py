from typing import Optional

from pydantic import BaseModel


class WineScanResult(BaseModel):
    bodega: Optional[str] = None
    nombre_vino: Optional[str] = None
    varietal: Optional[str] = None
    anada: Optional[int] = None
    region: Optional[str] = None
    alcohol: Optional[str] = None


class WineCreateInput(BaseModel):
    fecha_ingreso: str
    bodega: str
    nombre_vino: str
    varietal: str
    anada: int
    region: str
    alcohol: str
    cantidad: int = 1
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None
    foto_url: Optional[str] = None


class WineConsumeInput(BaseModel):
    fecha_consumo: Optional[str] = None
    puntuacion: int
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
