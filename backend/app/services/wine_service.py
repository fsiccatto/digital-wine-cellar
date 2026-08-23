import uuid
from datetime import datetime

from pydantic import ValidationError

from app.schemas.wine_schema import WineConsumeInput, WineCreateInput, WineRecord
from app.services import storage_service
from app.services.sheets_service import (
    append_cata_record,
    append_inventory_row,
    get_inventory_rows,
    update_inventory_photo,
    update_inventory_quantity,
)
from app.utils.wine_code import build_wine_code, next_sequence


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
