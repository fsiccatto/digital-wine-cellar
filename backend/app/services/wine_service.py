import logging
import uuid
from datetime import datetime

from pydantic import ValidationError

from app.schemas.wine_schema import (
    CataRecord,
    WineConsumeInput,
    WineCreateInput,
    WineRecord,
    WineUpdateInput,
)
from app.services import storage_service
from app.services.sheets_service import (
    append_cata_record,
    append_inventory_row,
    delete_inventory_row,
    get_catas_rows,
    get_inventory_rows,
    update_inventory_photo,
    update_inventory_quantity,
    update_inventory_row,
)
from app.utils.wine_code import build_wine_code, next_sequence

logger = logging.getLogger(__name__)


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
    rows = get_inventory_rows()
    wine = next((item for item in rows if item.get("codigo_vino") == codigo_vino), None)
    if wine is None:
        raise ValueError("No se encontró el vino solicitado.")

    current_quantity = int(wine.get("cantidad") or 0)
    if current_quantity <= 0:
        raise ValueError("No hay stock disponible para consumir.")

    updated_quantity = current_quantity - 1
    update_inventory_quantity(codigo_vino, updated_quantity)

    append_cata_record({
        "id_cata": str(uuid.uuid4()),
        "vino_id": codigo_vino,
        "fecha_consumo": datetime.now().isoformat(timespec="seconds"),
        "puntuacion": payload.puntuacion,
        "notas_cata": payload.notas_cata,
        "maridaje": payload.maridaje,
    })

    return {"status": "ok", "stock_restante": updated_quantity}


def list_catas(codigo_vino: str | None = None) -> list[CataRecord]:
    """Histórico de catas, opcionalmente filtrado por vino, más nuevas primero.

    El join usa `get_inventory_rows()` crudo y no `list_wines()`: solo hacen
    falta tres campos de texto, y `list_wines` firma una URL de GCS por cada
    foto — trabajo tirado acá.
    """
    rows = get_catas_rows()
    if codigo_vino is not None:
        rows = [row for row in rows if row.get("vino_id") == codigo_vino]
    if not rows:
        return []

    index = {
        row.get("codigo_vino"): row
        for row in get_inventory_rows()
        if row.get("codigo_vino")
    }

    catas = []
    for row in rows:
        wine = index.get(row.get("vino_id"))
        try:
            catas.append(
                CataRecord(
                    **row,
                    vino_existe=wine is not None,
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
    wine = get_wine(codigo_vino)
    changes = payload.model_dump()
    update_inventory_row(
        codigo_vino,
        {key: "" if value is None else value for key, value in changes.items()},
    )
    # Se reconstruye en memoria en vez de releer el Sheet: ya sabemos qué cambió.
    return wine.model_copy(update=changes)


def delete_wine(codigo_vino: str) -> dict:
    """Borra el vino del inventario. Las catas se conservan a propósito.

    El orden es deliberado: primero la fila, después la foto. Si GCS falla queda
    un blob huérfano (barato e invisible); al revés quedaría una fila apuntando a
    una foto inexistente.
    """
    row = next(
        (item for item in get_inventory_rows() if item.get("codigo_vino") == codigo_vino),
        None,
    )
    if row is None:
        raise ValueError("No se encontró el vino solicitado.")

    # El nombre del objeto, crudo: get_wine devuelve la URL firmada.
    object_name = row.get("foto_url") or None

    delete_inventory_row(codigo_vino)

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
    `consume_wine`."""
    wine = get_wine(codigo_vino)

    updated_quantity = wine.cantidad + delta
    if updated_quantity < 0:
        raise ValueError("El stock no puede quedar negativo.")

    update_inventory_quantity(codigo_vino, updated_quantity)
    return wine.model_copy(update={"cantidad": updated_quantity})
