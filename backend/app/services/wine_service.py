import uuid
from datetime import datetime

from app.schemas.wine_schema import WineConsumeInput, WineCreateInput
from app.services.sheets_service import (
    append_cata_record,
    append_inventory_row,
    get_inventory_rows,
    update_inventory_quantity,
)


def list_wines():
    return get_inventory_rows()


def create_wine(payload: WineCreateInput):
    wine_id = str(uuid.uuid4())
    wine_code = f"VINO-{wine_id[:8].upper()}"
    row = {
        "id": wine_id,
        "codigo_vino": wine_code,
        "fecha_ingreso": datetime.now().isoformat(timespec="seconds"),
        "bodega": payload.bodega,
        "nombre_vino": payload.nombre_vino,
        "varietal": payload.varietal,
        "anada": payload.anada,
        "region": payload.region,
        "alcohol": payload.alcohol,
        "cantidad": payload.cantidad,
        "ubicacion": payload.ubicacion or "",
        "precio_estimado": payload.precio_estimado if payload.precio_estimado is not None else "",
        "foto_url": payload.foto_url or "",
    }
    append_inventory_row(row)
    return row


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
