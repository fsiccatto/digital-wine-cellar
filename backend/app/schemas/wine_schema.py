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


def normalize_alcohol(value):
    """Deja la graduacion como un numero con punto y sin el simbolo: "13.5".

    Se acepta la coma al escribir porque es como se teclea en es-AR, pero se
    guarda con punto: el Sheet ya tiene "12,5" mezclado entre once valores con
    punto, y dos formas del mismo dato no se ordenan ni se comparan.

    Lo que no parece un numero se deja tal cual: es texto libre y una fila vieja
    del Sheet no tiene por que romperse.
    """
    value = normalize_optional_text(value)
    if not isinstance(value, str):
        return value

    limpio = value.replace("%", "").replace(",", ".").strip()
    # Una sola coma decimal, no un separador de miles: "13.5" si, "1.234.5" no.
    if limpio.count(".") > 1:
        return value

    try:
        numero = float(limpio)
    except ValueError:
        return value

    # Sin decimales sobrantes: 14.0 se guarda "14", no "14.0".
    entero = int(numero)
    return str(entero) if numero == entero else str(numero)


def normalize_required_text(value):
    value = normalize_optional_text(value)
    if value is None:
        raise ValueError("El campo no puede estar vacío.")
    return value


def normalize_required_alcohol(value):
    """Como normalize_alcohol, pero vacio no pasa: al cargar es obligatorio."""
    return normalize_required_text(normalize_alcohol(value))


class WineScanResult(BaseModel):
    bodega: Optional[str] = None
    nombre_vino: Optional[str] = None
    varietal: Optional[str] = None
    region: Optional[str] = None
    alcohol: Optional[str] = None

    _normalize_text = field_validator(
        "bodega", "nombre_vino", "varietal", "region", mode="before"
    )(normalize_optional_text)
    _normalize_alcohol = field_validator("alcohol", mode="before")(normalize_alcohol)

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
        "bodega", "nombre_vino", "varietal", "region", mode="before"
    )(normalize_required_text)
    _normalize_alcohol = field_validator("alcohol", mode="before")(
        normalize_required_alcohol
    )


class WineUpdateInput(BaseModel):
    """Igual a WineCreateInput pero sin `cantidad`: el stock se mueve aparte.

    `extra="forbid"` corta que el cliente mande `codigo_vino` esperando que se
    regenere: el código es inmutable.
    """

    model_config = ConfigDict(extra="forbid")

    bodega: str
    nombre_vino: str
    varietal: str
    anada: int = Field(ge=1900, le=CURRENT_YEAR)
    region: str
    alcohol: str
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None

    _normalize_required = field_validator(
        "bodega", "nombre_vino", "varietal", "region", mode="before"
    )(normalize_required_text)
    _normalize_alcohol = field_validator("alcohol", mode="before")(
        normalize_required_alcohol
    )


class WineStockInput(BaseModel):
    """Ajuste relativo, no absoluto: el frontend son botones +/- y un absoluto
    pisaría un cambio concurrente."""

    model_config = ConfigDict(extra="forbid")

    delta: int

    @field_validator("delta")
    @classmethod
    def _reject_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("El ajuste de stock no puede ser cero.")
        return value


def validar_media_copa(value):
    """La puntuacion va de 0,5 a 5 y solo en saltos de medio punto.

    Media copa es medio punto: cinco copas grandes dan diez valores posibles,
    sin pedirle al dedo que apunte a blancos de 15px.
    """
    if value is None:
        return None
    numero = parse_sheet_number(value) if isinstance(value, str) else value
    if numero is None:
        return None
    if float(numero) * 2 != int(float(numero) * 2):
        raise ValueError("La puntuación va de medio punto en medio punto.")
    return float(numero)


class CataUpdateInput(BaseModel):
    """Lo que se puede corregir de una cata ya registrada.

    No incluye `vino_id` ni `fecha_consumo`: mover una cata de vino la
    convierte en otra cata, y la fecha la puso el servidor al descorchar.
    """

    model_config = ConfigDict(extra="forbid")

    puntuacion: float = Field(ge=0.5, le=5)

    _media_copa = field_validator("puntuacion", mode="before")(validar_media_copa)
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None

    _normalize_text = field_validator("notas_cata", "maridaje", mode="before")(
        normalize_optional_text
    )


class CataCreateInput(BaseModel):
    """Una cata suelta: se tomó la botella pero no sale del stock de la app.

    Sirve para anotar algo abierto ayer, o probado afuera. Por eso lleva fecha
    del cliente, a diferencia de descorchar, que siempre es "ahora".
    """

    model_config = ConfigDict(extra="forbid")

    puntuacion: float = Field(ge=0.5, le=5)

    _media_copa = field_validator("puntuacion", mode="before")(validar_media_copa)
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None
    fecha_consumo: Optional[str] = None

    _normalize_text = field_validator("notas_cata", "maridaje", mode="before")(
        normalize_optional_text
    )

    @field_validator("fecha_consumo")
    @classmethod
    def _validar_fecha(cls, value):
        if value is None:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("La fecha de consumo no tiene un formato válido.") from exc
        # Una cata del futuro es siempre un error de carga.
        if parsed > datetime.now():
            raise ValueError("La fecha de consumo no puede estar en el futuro.")
        return parsed.isoformat(timespec="seconds")


class WineConsumeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    puntuacion: float = Field(ge=0.5, le=5)

    _media_copa = field_validator("puntuacion", mode="before")(validar_media_copa)
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

    # Las filas ya cargadas traen "14.2", "12,5" y "14" mezclados: se emparejan
    # al leer para que la app las muestre igual sin tocar el Sheet.
    _normalize_alcohol = field_validator("alcohol", mode="before")(normalize_alcohol)

    # El Sheet devuelve las celdas con formato como texto ("$32.000").
    _parse_precio = field_validator("precio_estimado", mode="before")(parse_sheet_number)
    _parse_cantidad = field_validator("cantidad", "anada", mode="before")(
        parse_sheet_number
    )


class CataRecord(BaseModel):
    id_cata: str
    vino_id: str
    fecha_consumo: str
    # Opcional a propósito: una fila cargada a mano sin nota no debe invalidar
    # el registro entero.
    puntuacion: Optional[float] = None
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None

    # Datos del join contra el inventario.
    bodega: Optional[str] = None
    nombre_vino: Optional[str] = None
    anada: Optional[int] = None
    vino_existe: bool = False

    _normalize_text = field_validator(
        "notas_cata", "maridaje", mode="before"
    )(normalize_optional_text)

    # Las celdas con formato vuelven como texto; es el bug que ya nos hizo
    # desaparecer un vino del inventario.
    _parse_numbers = field_validator("puntuacion", "anada", mode="before")(
        parse_sheet_number
    )
