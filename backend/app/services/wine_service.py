import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from pydantic import ValidationError

from app.schemas.wine_schema import (
    CataCreateInput,
    CataRecord,
    CataUpdateInput,
    WineConsumeInput,
    WineCreateInput,
    WineRecord,
    WineUpdateInput,
)
from app.services import storage_service
from app.services.sheets_service import (
    append_cata_record,
    append_inventory_row,
    delete_cata_row,
    delete_inventory_row,
    get_catas_rows,
    get_catas_values,
    get_inventory_rows,
    get_inventory_values,
    update_cata_row,
    update_inventory_photo,
    update_inventory_quantity,
    update_inventory_row,
)
from app.utils.wine_code import build_wine_code, next_sequence

logger = logging.getLogger(__name__)


def _fila_como_dict(values: list[list[str]], columna: str, clave: str) -> dict | None:
    """Busca una fila en la planilla YA LEIDA y la devuelve como dict.

    Existe para no leer dos veces lo mismo. El patron que se repetia era:
    resolver el registro con una lectura y, adentro de la escritura, releer la
    pestaña entera para saber en que fila cae. Cada una de esas lecturas cuesta
    ~0,35s contra Sheets, y son la mitad del tiempo de un PATCH de stock.
    """
    if len(values) <= 1:
        return None
    headers = values[0]
    if columna not in headers:
        return None
    indice = headers.index(columna)
    for fila in values[1:]:
        if len(fila) > indice and fila[indice] == clave:
            return {
                header: fila[i] if i < len(fila) else ""
                for i, header in enumerate(headers)
            }
    return None


def _with_photo_url(record: WineRecord) -> WineRecord:
    """Cambia el nombre del objeto guardado por una URL de lectura temporal."""
    if not record.foto_url or not storage_service.is_configured():
        return record
    return record.model_copy(
        update={"foto_url": storage_service.build_signed_url(record.foto_url)}
    )


def list_wines() -> list[WineRecord]:
    wines = []
    for row in get_inventory_rows():
        try:
            wines.append(_with_photo_url(WineRecord(**row)))
        except ValidationError:
            # Filas editadas a mano en el Sheet no deben invalidar todo el inventario.
            continue
    return wines


def get_wine(codigo_vino: str) -> WineRecord:
    wine = next(
        (item for item in list_wines() if item.codigo_vino == codigo_vino), None
    )
    if wine is None:
        raise ValueError("No se encontró el vino solicitado.")
    return wine


def attach_label_photo(
    codigo_vino: str, image_bytes: bytes, content_type: str
) -> WineRecord:
    """Sube la foto de etiqueta y deja su nombre de objeto en el Sheet."""
    if not storage_service.is_configured():
        raise storage_service.StorageNotConfigured(
            "Falta GCS_BUCKET_NAME en el entorno: no se pueden guardar fotos."
        )

    # Se resuelve primero para no subir una foto de un código que no existe.
    wine = next(
        (
            item
            for item in get_inventory_rows()
            if item.get("codigo_vino") == codigo_vino
        ),
        None,
    )
    if wine is None:
        raise ValueError("No se encontró el vino solicitado.")

    object_name = storage_service.upload_label_photo(
        codigo_vino=codigo_vino,
        image_bytes=image_bytes,
        content_type=content_type,
    )
    update_inventory_photo(codigo_vino, object_name)
    return get_wine(codigo_vino)


def create_wine(payload: WineCreateInput) -> WineRecord:
    rows = get_inventory_rows()
    sequence = next_sequence(rows, payload.bodega, payload.varietal, payload.anada)
    record = WineRecord(
        id=str(uuid.uuid4()),
        codigo_vino=build_wine_code(
            bodega=payload.bodega,
            varietal=payload.varietal,
            anada=payload.anada,
            sequence=sequence,
        ),
        fecha_ingreso=datetime.now().isoformat(timespec="seconds"),
        **payload.model_dump(),
    )
    append_inventory_row(
        {
            key: "" if value is None else value
            for key, value in record.model_dump().items()
        }
    )
    return record


def consume_wine(codigo_vino: str, payload: WineConsumeInput):
    """Descuenta una botella y registra la cata.

    Descorchar medido tardaba ~2,2s, y casi todo eran viajes a Sheets: se leia
    el inventario entero DOS veces (una aca y otra adentro de la escritura, para
    saber en que fila cae) y despues se escribia dos veces en serie.

    Ahora se lee una sola vez y esa lectura se le pasa a la escritura. Las dos
    escrituras van en paralelo porque caen en pestañas distintas —el stock en
    Inventario, la cata en Historico_Catas— asi que no se pisan.
    """
    values = get_inventory_values()
    if len(values) <= 1:
        raise ValueError("No se encontró el vino solicitado.")

    headers = values[0]
    fila = next(
        (
            row
            for row in values[1:]
            if len(row) > headers.index("codigo_vino")
            and row[headers.index("codigo_vino")] == codigo_vino
        ),
        None,
    )
    if fila is None:
        raise ValueError("No se encontró el vino solicitado.")

    def celda(columna: str) -> str:
        indice = headers.index(columna)
        return fila[indice] if indice < len(fila) else ""

    current_quantity = int(celda("cantidad") or 0)
    if current_quantity <= 0:
        raise ValueError("No hay stock disponible para consumir.")

    updated_quantity = current_quantity - 1
    cata = {
        "id_cata": str(uuid.uuid4()),
        # El uuid del vino, no su codigo: el codigo se puede reusar si el vino
        # se borra y se carga otro parecido, y ahi la cata vieja se colgaria del
        # vino equivocado. El uuid no se repite nunca.
        "vino_id": celda("id"),
        # Copia legible, para poder leer la hoja sin cruzarla contra Inventario.
        # No se lee nunca de vuelta: el join va por vino_id.
        "codigo_vino": codigo_vino,
        "fecha_consumo": datetime.now().isoformat(timespec="seconds"),
        "puntuacion": payload.puntuacion,
        "notas_cata": payload.notas_cata,
        "maridaje": payload.maridaje,
    }

    with ThreadPoolExecutor(max_workers=2) as pool:
        escrituras = [
            pool.submit(update_inventory_quantity, codigo_vino, updated_quantity, values),
            pool.submit(append_cata_record, cata),
        ]
        # `result()` re-lanza lo que haya fallado, asi que un error de Sheets
        # sigue llegando como error y no se traga en el hilo.
        for escritura in escrituras:
            escritura.result()

    return {"status": "ok", "stock_restante": updated_quantity}


def list_catas(codigo_vino: str | None = None) -> list[CataRecord]:
    """Histórico de catas, opcionalmente filtrado por vino, más nuevas primero.

    El join usa `get_inventory_rows()` crudo y no `list_wines()`: solo hacen
    falta tres campos de texto, y `list_wines` firma una URL de GCS por cada
    foto — trabajo tirado acá.
    """
    rows = get_catas_rows()
    # Antes de tocar el inventario: sin una sola cata no hay nada que unir, y
    # esa lectura de mas cuesta ~0,35s contra Sheets.
    if not rows:
        return []

    # El indice va por las dos claves a proposito. Las catas nuevas guardan el
    # uuid del vino; las viejas guardan su codigo, y tienen que seguir
    # encontrando su vino sin obligar a migrar la planilla.
    index = {}
    for wine_row in get_inventory_rows():
        for clave in (wine_row.get("id"), wine_row.get("codigo_vino")):
            if clave:
                index[clave] = wine_row

    if codigo_vino is not None:
        objetivo = index.get(codigo_vino)
        claves = {codigo_vino}
        if objetivo and objetivo.get("id"):
            claves.add(objetivo["id"])
        rows = [row for row in rows if row.get("vino_id") in claves]
        if not rows:
            return []

    catas = []
    for row in rows:
        wine = index.get(row.get("vino_id"))
        # El `codigo_vino` de la fila es una copia para leer la hoja y puede
        # estar vieja; el que sale por la API se resuelve por el join.
        row = {key: value for key, value in row.items() if key != "codigo_vino"}
        try:
            catas.append(
                CataRecord(
                    **row,
                    vino_existe=wine is not None,
                    codigo_vino=wine.get("codigo_vino") if wine else None,
                    bodega=wine.get("bodega") if wine else None,
                    nombre_vino=wine.get("nombre_vino") if wine else None,
                    anada=wine.get("anada") if wine else None,
                )
            )
        except ValidationError:
            # Filas editadas a mano en el Sheet no deben invalidar el histórico.
            continue

    catas.sort(key=lambda cata: cata.fecha_consumo, reverse=True)
    return catas


def update_wine(codigo_vino: str, payload: WineUpdateInput) -> WineRecord:
    """Edita los datos del vino. El código NO se regenera: es inmutable."""
    values = get_inventory_values()
    row = _fila_como_dict(values, "codigo_vino", codigo_vino)
    if row is None:
        raise ValueError("No se encontró el vino solicitado.")

    wine = _with_photo_url(WineRecord(**row))
    changes = payload.model_dump()
    update_inventory_row(
        codigo_vino,
        {key: "" if value is None else value for key, value in changes.items()},
        values,
    )
    # Se reconstruye en memoria en vez de releer el Sheet: ya sabemos qué cambió.
    return wine.model_copy(update=changes)


def delete_wine(codigo_vino: str) -> dict:
    """Borra el vino del inventario. Las catas se conservan a propósito.

    El orden es deliberado: primero la fila, después la foto. Si GCS falla queda
    un blob huérfano (barato e invisible); al revés quedaría una fila apuntando a
    una foto inexistente.
    """
    values = get_inventory_values()
    row = _fila_como_dict(values, "codigo_vino", codigo_vino)
    if row is None:
        raise ValueError("No se encontró el vino solicitado.")

    # El nombre del objeto, crudo: get_wine devuelve la URL firmada.
    object_name = row.get("foto_url") or None

    delete_inventory_row(codigo_vino, values)

    if object_name and storage_service.is_configured():
        try:
            storage_service.delete_label_photo(object_name)
        except Exception:
            logger.warning(
                "El vino %s se borró pero su foto %s quedó en el bucket.",
                codigo_vino,
                object_name,
                exc_info=True,
            )

    return {"status": "ok", "codigo_vino": codigo_vino}


def adjust_stock(codigo_vino: str, delta: int) -> WineRecord:
    """Corrige el inventario sin registrar una cata: esa es la diferencia con
    `consume_wine`.

    Lee la planilla UNA vez y se la pasa a la escritura. Antes resolvia el vino
    con `get_wine` y despues la escritura la releia entera para ubicar la fila.
    """
    values = get_inventory_values()
    row = _fila_como_dict(values, "codigo_vino", codigo_vino)
    if row is None:
        raise ValueError("No se encontró el vino solicitado.")

    wine = _with_photo_url(WineRecord(**row))
    updated_quantity = wine.cantidad + delta
    if updated_quantity < 0:
        raise ValueError("El stock no puede quedar negativo.")

    update_inventory_quantity(codigo_vino, updated_quantity, values)
    return wine.model_copy(update={"cantidad": updated_quantity})


def _cata_por_id(values: list[list[str]], id_cata: str) -> dict:
    row = _fila_como_dict(values, "id_cata", id_cata)
    if row is None:
        raise ValueError("No se encontró la cata solicitada.")
    return row


def add_cata(codigo_vino: str, payload: CataCreateInput) -> CataRecord:
    """Registra una cata sin tocar el stock.

    Descorchar y anotar son cosas distintas: esto sirve para una botella que se
    abrió ayer, o que se probó afuera y nunca estuvo en la cava.
    """
    wine = get_wine(codigo_vino)

    row = {
        "id_cata": str(uuid.uuid4()),
        # El uuid del vino, igual que al descorchar. Ver `consume_wine`.
        "vino_id": wine.id,
        "codigo_vino": wine.codigo_vino,
        "fecha_consumo": payload.fecha_consumo
        or datetime.now().isoformat(timespec="seconds"),
        "puntuacion": payload.puntuacion,
        "notas_cata": payload.notas_cata,
        "maridaje": payload.maridaje,
    }
    append_cata_record(row)

    return CataRecord(
        **{key: "" if value is None else value for key, value in row.items()},
        vino_existe=True,
        bodega=wine.bodega,
        nombre_vino=wine.nombre_vino,
        anada=wine.anada,
    )


def update_cata(id_cata: str, payload: CataUpdateInput) -> CataRecord:
    """Corrige una cata ya registrada. No mueve el stock ni cambia de vino."""
    values = get_catas_values()
    row = _cata_por_id(values, id_cata)

    cambios = payload.model_dump()
    update_cata_row(
        id_cata,
        {key: "" if value is None else value for key, value in cambios.items()},
        values,
    )

    fusionada = {**row, **{k: ("" if v is None else v) for k, v in cambios.items()}}
    referencia = fusionada.get("vino_id")
    # Igual que en `list_catas`: la copia de la hoja no decide.
    fusionada.pop("codigo_vino", None)
    # Por uuid o por codigo, como en `list_catas`: una cata vieja sin migrar
    # tiene que seguir mostrando su vino despues de corregirla.
    wine = next(
        (
            item
            for item in get_inventory_rows()
            if referencia in (item.get("id"), item.get("codigo_vino"))
        ),
        None,
    )
    return CataRecord(
        **fusionada,
        vino_existe=wine is not None,
        codigo_vino=wine.get("codigo_vino") if wine else None,
        bodega=wine.get("bodega") if wine else None,
        nombre_vino=wine.get("nombre_vino") if wine else None,
        anada=wine.get("anada") if wine else None,
    )


def delete_cata(id_cata: str) -> dict:
    """Borra una cata del histórico. El stock del vino no se toca.

    Descorchar ya descontó la botella y esa botella se tomó igual: devolverla al
    inventario por corregir el registro seria inventar stock.
    """
    values = get_catas_values()
    _cata_por_id(values, id_cata)
    delete_cata_row(id_cata, values)
    return {"status": "ok", "id_cata": id_cata}
