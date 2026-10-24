"""Los vinos que todavia no estan en la cava: probados afuera o recomendados.

Viven en su propia pestaña y no en Inventario con stock 0: no tienen codigo
(falta casi siempre la añada o el varietal), y "se me acabo" y "nunca lo tuve"
no son lo mismo.
"""

import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from pydantic import ValidationError

from app.schemas.wine_schema import PendienteInput, PendienteRecord
from app.services import storage_service
from app.services.sheets_service import (
    append_cata_record,
    append_pendiente_row,
    delete_pendiente_row,
    get_inventory_values,
    get_pendientes_rows,
    get_pendientes_values,
    update_inventory_photo,
    update_pendiente_row,
)
from app.services.wine_service import _fila_como_dict

logger = logging.getLogger(__name__)


def _con_foto(record: PendienteRecord) -> PendienteRecord:
    if not record.foto_url or not storage_service.is_configured():
        return record
    return record.model_copy(
        update={"foto_url": storage_service.build_signed_url(record.foto_url)}
    )


def _pendiente(values: list[list[str]], id_pendiente: str) -> PendienteRecord:
    row = _fila_como_dict(values, "id", id_pendiente)
    if row is None:
        raise ValueError("No se encontró el vino pendiente.")
    try:
        return PendienteRecord(**row)
    except ValidationError as exc:
        # Una fila rota a mano en el Sheet: no hay de donde sacar el vino.
        raise ValueError("El vino pendiente tiene datos inválidos en la planilla.") from exc


def _fecha_probado(payload: PendienteInput, anterior: str | None = None) -> str:
    """Sin puntuacion no se probo, y una fecha sola no dice nada."""
    if payload.puntuacion is None:
        return ""
    return (
        payload.fecha_probado
        or anterior
        or datetime.now().isoformat(timespec="seconds")
    )


def list_pendientes() -> list[PendienteRecord]:
    """Todos, comprados incluidos, y los pendientes con la foto ya firmada.

    A diferencia del inventario, aca la lista SI muestra la foto: es lo que
    sirve para reconocer la botella en la vinoteca. Firmar es una cuenta local
    con la clave del Service Account, no un viaje a GCS. A los comprados no se
    les firma: la app los muestra con los datos del vino de la cava.
    """
    pendientes = []
    for row in get_pendientes_rows():
        try:
            record = PendienteRecord(**row)
        except ValidationError:
            # Filas editadas a mano en el Sheet no deben invalidar la lista.
            continue
        pendientes.append(record if record.vino_id else _con_foto(record))
    return pendientes


def create_pendiente(payload: PendienteInput) -> PendienteRecord:
    record = PendienteRecord(
        id=str(uuid.uuid4()),
        fecha_alta=datetime.now().isoformat(timespec="seconds"),
        **payload.model_dump(exclude={"fecha_probado"}),
        fecha_probado=_fecha_probado(payload),
    )
    append_pendiente_row(
        {key: "" if value is None else value for key, value in record.model_dump().items()}
    )
    return record


def update_pendiente(id_pendiente: str, payload: PendienteInput) -> PendienteRecord:
    """Reemplaza los datos. La foto, el alta y la compra no se tocan."""
    values = get_pendientes_values()
    actual = _pendiente(values, id_pendiente)

    cambios = {
        **payload.model_dump(exclude={"fecha_probado"}),
        # Corregir la nota no le cambia el dia en que se probo.
        "fecha_probado": _fecha_probado(payload, actual.fecha_probado),
    }
    update_pendiente_row(
        id_pendiente,
        {key: "" if value is None else value for key, value in cambios.items()},
        values,
    )
    return _con_foto(
        actual.model_copy(
            update={**cambios, "fecha_probado": cambios["fecha_probado"] or None}
        )
    )


def attach_pendiente_photo(
    id_pendiente: str, image_bytes: bytes, content_type: str
) -> PendienteRecord:
    if not storage_service.is_configured():
        raise storage_service.StorageNotConfigured(
            "Falta GCS_BUCKET_NAME en el entorno: no se pueden guardar fotos."
        )

    # Se resuelve primero para no subir una foto de un pendiente que no existe.
    values = get_pendientes_values()
    actual = _pendiente(values, id_pendiente)

    object_name = storage_service.upload_label_photo(
        clave=id_pendiente,
        image_bytes=image_bytes,
        content_type=content_type,
        carpeta=storage_service.CARPETA_PENDIENTES,
    )
    update_pendiente_row(id_pendiente, {"foto_url": object_name}, values)
    return _con_foto(actual.model_copy(update={"foto_url": object_name}))


def delete_pendiente(id_pendiente: str) -> dict:
    """Primero la fila y despues la foto, por lo mismo que `delete_wine`."""
    values = get_pendientes_values()
    actual = _pendiente(values, id_pendiente)

    delete_pendiente_row(id_pendiente, values)

    if actual.foto_url and storage_service.is_configured():
        try:
            storage_service.delete_label_photo(actual.foto_url)
        except Exception:
            logger.warning(
                "El pendiente %s se borró pero su foto %s quedó en el bucket.",
                id_pendiente,
                actual.foto_url,
                exc_info=True,
            )

    return {"status": "ok", "id": id_pendiente}


def marcar_comprado(id_pendiente: str, codigo_vino: str) -> PendienteRecord:
    """Lo cuelga del vino de la cava en el que termino.

    El vino ya se creo (o se le sumo stock) por el camino de siempre. Aca se
    hace lo que solo sabe el pendiente:

    - Si se probo, esa cata pasa al historico del vino con el dia en que se
      probo. El historial arranca en la cena, no en la compra.
    - Si tenia foto y el vino no, se copia: la etiqueta ya estaba sacada.

    Las tres escrituras caen en pestañas distintas y van en paralelo. Un
    pendiente que ya tiene vino no vuelve a escribir nada: reintentar despues
    de un error no duplica la cata.
    """
    pendientes = get_pendientes_values()
    pendiente = _pendiente(pendientes, id_pendiente)
    if pendiente.vino_id:
        return pendiente

    inventario = get_inventory_values()
    vino = _fila_como_dict(inventario, "codigo_vino", codigo_vino)
    if vino is None:
        raise ValueError("No se encontró el vino solicitado.")

    def copiar_foto():
        # La foto es un extra: si falla, el vino y la cata quedan igual, y el
        # reintento no la recuperaria porque el pendiente ya figura comprado.
        try:
            object_name = storage_service.copy_to_label(pendiente.foto_url, codigo_vino)
            update_inventory_photo(codigo_vino, object_name, inventario)
        except Exception:
            logger.warning(
                "El pendiente %s pasó a %s sin su foto.",
                id_pendiente,
                codigo_vino,
                exc_info=True,
            )

    escrituras = [
        lambda: update_pendiente_row(id_pendiente, {"vino_id": vino["id"]}, pendientes)
    ]
    if pendiente.puntuacion is not None:
        cata = {
            "id_cata": str(uuid.uuid4()),
            # El uuid, igual que al descorchar. Ver `consume_wine`.
            "vino_id": vino["id"],
            "codigo_vino": codigo_vino,
            "fecha_consumo": pendiente.fecha_probado or pendiente.fecha_alta,
            "puntuacion": pendiente.puntuacion,
            "notas_cata": pendiente.notas or "",
            "maridaje": pendiente.maridaje or "",
        }
        escrituras.append(lambda: append_cata_record(cata))
    if (
        pendiente.foto_url
        and not vino.get("foto_url")
        and storage_service.is_configured()
    ):
        escrituras.append(copiar_foto)

    with ThreadPoolExecutor(max_workers=len(escrituras)) as pool:
        # `result()` re-lanza lo que haya fallado en el hilo.
        for escritura in [pool.submit(tarea) for tarea in escrituras]:
            escritura.result()

    return pendiente.model_copy(update={"vino_id": vino["id"]})
