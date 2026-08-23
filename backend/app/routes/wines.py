from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.wine_schema import WineConsumeInput, WineCreateInput, WineRecord
from app.services.storage_service import StorageNotConfigured
from app.services.wine_service import (
    attach_label_photo,
    consume_wine,
    create_wine,
    get_wine,
    list_wines,
)
from app.utils.image_upload import read_validated_image

router = APIRouter(prefix="/api", tags=["wines"])


@router.get("/wines", response_model=list[WineRecord])
def get_wines():
    try:
        return list_wines()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get("/wines/{codigo_vino}", response_model=WineRecord)
def get_wine_route(codigo_vino: str):
    try:
        return get_wine(codigo_vino)
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


@router.post("/wines", response_model=WineRecord)
def create_new_wine(payload: WineCreateInput):
    try:
        return create_wine(payload)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/wines/{codigo_vino}/foto", response_model=WineRecord)
async def upload_label_photo_route(codigo_vino: str, file: UploadFile = File(...)):
    image_bytes = await read_validated_image(file)

    try:
        return attach_label_photo(
            codigo_vino=codigo_vino,
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


@router.post("/wines/{codigo_vino}/consume")
def consume_wine_route(codigo_vino: str, payload: WineConsumeInput):
    try:
        return consume_wine(codigo_vino, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
