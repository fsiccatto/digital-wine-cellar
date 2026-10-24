from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

CURRENT_YEAR = datetime.now().year

# Tope de los campos que vuelven del scan. La foto la elige el usuario y el
# modelo obedece a lo que dice la etiqueta, asi que su salida es entrada no
# confiable como cualquier otra.
MAX_SCAN_TEXT_LENGTH = 200


def normalize_optional_text(value):
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    value = value.strip()
    return value or None


def coerce_scanned_scalar(value):
    """Lleva a texto lo que el modelo devolvio con otro tipo.

    El prompt pide strings pero el modelo no esta obligado a obedecer: manda
    `13.5` sin comillas, o `["Malbec", "Cabernet"]` cuando el vino es un corte.
    Antes eso reventaba el pedido ENTERO con un ValidationError, y se perdian
    los cinco campos que si habian salido bien.

    Un dict no se aplana: no hay una forma obvia de volverlo una linea de
    etiqueta, y `str(dict)` guardaria las llaves en el Sheet. Ese va a None,
    que es el caso "no se pudo leer" que el formulario ya sabe completar.
    """
    if value is None or isinstance(value, str):
        return value
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return str(value)
    # Un corte que vuelve como lista se une con el mismo " & " que pide el prompt.
    if isinstance(value, (list, tuple)):
        partes = [str(x).strip() for x in value if x is not None and str(x).strip()]
        return " & ".join(partes) or None
    return None


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


def truncate_scanned_text(value):
    """Corta lo que devuelve el modelo a un largo de etiqueta razonable.

    Lo que se lee de la foto es texto que eligio quien saco la foto: una
    etiqueta preparada puede pedirle al modelo que devuelva parrafos enteros,
    y eso termina escrito en el Sheet. Ningun campo real de una etiqueta pasa
    de 200 caracteres.
    """
    value = normalize_optional_text(coerce_scanned_scalar(value))
    if isinstance(value, str) and len(value) > MAX_SCAN_TEXT_LENGTH:
        return value[:MAX_SCAN_TEXT_LENGTH]
    return value


def coerce_scanned_year(value):
    """Una añada que no se entiende vale None, no un pedido roto.

    `anada` es el campo mas facil de que salga raro: un espumante sin añada
    devuelve "N/V", y un 2021 mal leido puede salir 2027. Como el resto del
    escaneo suele estar bien, tirar ValidationError acá costaba los otros cinco
    campos y obligaba a cargar la botella entera a mano.

    Ojo que esto es solo para el escaneo: `WineCreateInput` sigue exigiendo una
    añada valida, porque ahi el dato lo confirmo el usuario.
    """
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
    if isinstance(value, bool):
        return None
    try:
        anada = int(value)
    except (TypeError, ValueError):
        return None
    return anada if 1900 <= anada <= CURRENT_YEAR else None


class WineScanResult(BaseModel):
    bodega: Optional[str] = None
    nombre_vino: Optional[str] = None
    varietal: Optional[str] = None
    region: Optional[str] = None
    alcohol: Optional[str] = None

    _normalize_text = field_validator(
        "bodega", "nombre_vino", "varietal", "region", mode="before"
    )(truncate_scanned_text)
    _normalize_alcohol = field_validator("alcohol", mode="before")(
        lambda value: normalize_alcohol(coerce_scanned_scalar(value))
    )

    # Sin ge/le: el rango lo aplica `coerce_scanned_year`, que en vez de
    # rechazar devuelve None. Ver el docstring de esa funcion.
    anada: Optional[int] = None

    _normalize_anada = field_validator("anada", mode="before")(coerce_scanned_year)


class WineCreateInput(BaseModel):
    """Lo obligatorio es lo que arma el codigo, mas un nombre para mostrarlo.

    Region y graduacion son opcionales por los vinos sin etiqueta: una caja
    comprada al productor no dice ninguna de las dos. `distintivo` es como se
    reconoce esa botella en el estante (lo escrito con fibra, una cinta).
    """

    model_config = ConfigDict(extra="forbid")

    bodega: str
    nombre_vino: str
    varietal: str
    anada: int = Field(ge=1900, le=CURRENT_YEAR)
    region: Optional[str] = None
    alcohol: Optional[str] = None
    cantidad: int = Field(default=1, ge=0)
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None
    distintivo: Optional[str] = None
    # foto_url no se acepta acá: la foto se sube a POST /wines/{codigo}/foto,
    # que es quien escribe el nombre del objeto en el Sheet.

    _normalize_required = field_validator(
        "bodega", "nombre_vino", "varietal", mode="before"
    )(normalize_required_text)
    _normalize_optional = field_validator("region", "distintivo", mode="before")(
        normalize_optional_text
    )
    _normalize_alcohol = field_validator("alcohol", mode="before")(normalize_alcohol)


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
    region: Optional[str] = None
    alcohol: Optional[str] = None
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None
    distintivo: Optional[str] = None

    _normalize_required = field_validator(
        "bodega", "nombre_vino", "varietal", mode="before"
    )(normalize_required_text)
    _normalize_optional = field_validator("region", "distintivo", mode="before")(
        normalize_optional_text
    )
    _normalize_alcohol = field_validator("alcohol", mode="before")(normalize_alcohol)


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


def validar_fecha_consumo(value):
    """Una fecha ISO que no este en el futuro, o None para "ahora".

    La cata se anota cuando uno se acuerda, que no siempre es la noche en que
    se abrio la botella: por eso la fecha la puede elegir el cliente.
    """
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("La fecha de consumo no tiene un formato válido.") from exc
    # Con zona ("...Z", "+05:00") se pasa a la hora local: comparar una fecha
    # con zona contra `now()` tira TypeError, que pydantic no atrapa y sale 500.
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone().replace(tzinfo=None)
    # Una cata del futuro es siempre un error de carga.
    if parsed > datetime.now():
        raise ValueError("La fecha de consumo no puede estar en el futuro.")
    return parsed.isoformat(timespec="seconds")


class CataUpdateInput(BaseModel):
    """Lo que se puede corregir de una cata ya registrada.

    No incluye `vino_id`: mover una cata de vino la convierte en otra cata.
    `fecha_consumo` en None deja la que estaba, a diferencia de las notas, que
    en None se vacian: una cata sin fecha no se ordena en el historico.
    """

    model_config = ConfigDict(extra="forbid")

    puntuacion: Optional[float] = Field(default=None, ge=0.5, le=5)

    _media_copa = field_validator("puntuacion", mode="before")(validar_media_copa)
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None
    fecha_consumo: Optional[str] = None

    _normalize_text = field_validator("notas_cata", "maridaje", mode="before")(
        normalize_optional_text
    )
    _fecha = field_validator("fecha_consumo")(validar_fecha_consumo)


class CataCreateInput(BaseModel):
    """Una cata suelta: se tomó la botella pero no sale del stock de la app.

    Sirve para anotar algo probado afuera, que nunca estuvo en la cava.
    """

    model_config = ConfigDict(extra="forbid")

    puntuacion: Optional[float] = Field(default=None, ge=0.5, le=5)

    _media_copa = field_validator("puntuacion", mode="before")(validar_media_copa)
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None
    fecha_consumo: Optional[str] = None

    _normalize_text = field_validator("notas_cata", "maridaje", mode="before")(
        normalize_optional_text
    )
    _fecha = field_validator("fecha_consumo")(validar_fecha_consumo)


class WineConsumeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Opcional: el vino barato que se llevo a un asado se toma igual, sin
    # ganas de puntuarlo. Queda en el historico como "se tomo tal dia", que
    # es lo que el ajuste de stock no deja.
    puntuacion: Optional[float] = Field(default=None, ge=0.5, le=5)

    _media_copa = field_validator("puntuacion", mode="before")(validar_media_copa)
    notas_cata: Optional[str] = None
    maridaje: Optional[str] = None
    # La botella que se abrio hace tres dias y se anota hoy.
    fecha_consumo: Optional[str] = None

    _fecha = field_validator("fecha_consumo")(validar_fecha_consumo)


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
    # Vacias en un vino sin etiqueta. Ver WineCreateInput.
    region: Optional[str] = None
    alcohol: Optional[str] = None
    cantidad: int
    ubicacion: Optional[str] = None
    precio_estimado: Optional[float] = None
    foto_url: Optional[str] = None
    distintivo: Optional[str] = None

    # Las filas ya cargadas traen "14.2", "12,5" y "14" mezclados: se emparejan
    # al leer para que la app las muestre igual sin tocar el Sheet.
    _normalize_alcohol = field_validator("alcohol", mode="before")(normalize_alcohol)
    # La celda vacia llega como "": se manda null, que es lo que mira la app.
    _normalize_optional = field_validator("region", "distintivo", mode="before")(
        normalize_optional_text
    )

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
    # `vino_id` es el uuid del vino; el codigo legible sale de aca, y es por el
    # que navega el frontend porque es lo que aceptan las rutas /api/wines/{}.
    codigo_vino: Optional[str] = None
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


class PendienteInput(BaseModel):
    """Un vino que todavia no esta en la cava. Solo el nombre es obligatorio.

    Lo recomendado de palabra no trae mas que eso. La puntuacion es lo que dice
    que se probo: sin ella, las notas son lo que conto quien lo recomendo, y al
    comprarlo no se vuelve una cata.

    Sirve para crear y para editar: editar reemplaza todos los campos.
    """

    model_config = ConfigDict(extra="forbid")

    nombre_vino: str
    bodega: Optional[str] = None
    varietal: Optional[str] = None
    anada: Optional[int] = Field(default=None, ge=1900, le=CURRENT_YEAR)
    region: Optional[str] = None
    alcohol: Optional[str] = None
    # Quien lo recomendo o donde se probo: "Juan", "cena en lo de Ana".
    origen: Optional[str] = None
    puntuacion: Optional[float] = Field(default=None, ge=0.5, le=5)
    notas: Optional[str] = None
    maridaje: Optional[str] = None
    # Sin fecha y con puntuacion, es hoy.
    fecha_probado: Optional[str] = None

    _normalize_required = field_validator("nombre_vino", mode="before")(
        normalize_required_text
    )
    _normalize_optional = field_validator(
        "bodega", "varietal", "region", "origen", "notas", "maridaje", mode="before"
    )(normalize_optional_text)
    _normalize_alcohol = field_validator("alcohol", mode="before")(normalize_alcohol)
    _media_copa = field_validator("puntuacion", mode="before")(validar_media_copa)
    _fecha = field_validator("fecha_probado")(validar_fecha_consumo)


class PendienteCompradoInput(BaseModel):
    """El vino de la cava en el que termino el pendiente.

    Se crea antes por el camino de siempre (o se suma stock a uno que ya
    estaba): asi el pendiente no repite la logica de alta ni el aviso de
    duplicado.
    """

    model_config = ConfigDict(extra="forbid")

    codigo_vino: str


class PendienteRecord(BaseModel):
    id: str
    fecha_alta: str
    nombre_vino: str
    bodega: Optional[str] = None
    varietal: Optional[str] = None
    anada: Optional[int] = None
    region: Optional[str] = None
    alcohol: Optional[str] = None
    origen: Optional[str] = None
    puntuacion: Optional[float] = None
    notas: Optional[str] = None
    maridaje: Optional[str] = None
    fecha_probado: Optional[str] = None
    foto_url: Optional[str] = None
    # Vacio mientras esta pendiente; el uuid del vino una vez comprado.
    vino_id: Optional[str] = None

    # Una fila sin nombre, vaciada a mano, no es nada que se pueda mostrar.
    _normalize_required = field_validator("nombre_vino", mode="before")(
        normalize_required_text
    )
    _normalize_text = field_validator(
        "bodega",
        "varietal",
        "region",
        "origen",
        "notas",
        "maridaje",
        "fecha_probado",
        "foto_url",
        "vino_id",
        mode="before",
    )(normalize_optional_text)
    _normalize_alcohol = field_validator("alcohol", mode="before")(normalize_alcohol)
    _parse_numbers = field_validator("puntuacion", "anada", mode="before")(
        parse_sheet_number
    )
