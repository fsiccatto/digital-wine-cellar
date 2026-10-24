from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.wine_schema import (
    PendienteCompradoInput,
    PendienteInput,
    PendienteRecord,
)
from app.services.pendiente_service import (
    attach_pendiente_photo,
    create_pendiente,
    delete_pendiente,
    list_pendientes,
    marcar_comprado,
    update_pendiente,
)
from app.services.storage_service import StorageNotConfigured
from app.utils.image_upload import read_validated_image

router = APIRouter(prefix="/api", tags=["pendientes"])


@router.get("/pendientes", response_model=list[PendienteRecord])
def get_pendientes():
    try:
        return list_pendientes()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/pendientes", response_model=PendienteRecord)
def create_pendiente_route(payload: PendienteInput):
    try:
        return create_pendiente(payload)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.put("/pendientes/{id_pendiente}", response_model=PendienteRecord)
def update_pendiente_route(id_pendiente: str, payload: PendienteInput):
    try:
        return update_pendiente(id_pendiente, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.delete("/pendientes/{id_pendiente}")
def delete_pendiente_route(id_pendiente: str):
    try:
        return delete_pendiente(id_pendiente)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/pendientes/{id_pendiente}/foto", response_model=PendienteRecord)
async def upload_pendiente_photo_route(id_pendiente: str, file: UploadFile = File(...)):
    image_bytes = await read_validated_image(file)

    try:
        return attach_pendiente_photo(
            id_pendiente=id_pendiente,
            image_bytes=image_bytes,
            content_type=file.content_type,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except StorageNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/pendientes/{id_pendiente}/comprado", response_model=PendienteRecord)
def marcar_comprado_route(id_pendiente: str, payload: PendienteCompradoInput):
    try:
        return marcar_comprado(id_pendiente, payload.codigo_vino)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
