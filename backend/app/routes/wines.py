from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.wine_schema import (
    CataCreateInput,
    CataRecord,
    CataUpdateInput,
    WineConsumeInput,
    WineCreateInput,
    WineRecord,
    WineStockInput,
    WineUpdateInput,
)
from app.services.storage_service import StorageNotConfigured
from app.services.wine_service import (
    add_cata,
    adjust_stock,
    attach_label_photo,
    consume_wine,
    create_wine,
    delete_cata,
    delete_wine,
    get_wine,
    list_catas,
    list_wines,
    update_cata,
    update_wine,
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


@router.put("/wines/{codigo_vino}", response_model=WineRecord)
def update_wine_route(codigo_vino: str, payload: WineUpdateInput):
    try:
        return update_wine(codigo_vino, payload)
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


@router.delete("/wines/{codigo_vino}")
def delete_wine_route(codigo_vino: str):
    try:
        return delete_wine(codigo_vino)
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


@router.patch("/wines/{codigo_vino}/stock", response_model=WineRecord)
def adjust_stock_route(codigo_vino: str, payload: WineStockInput):
    try:
        return adjust_stock(codigo_vino, payload.delta)
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


@router.get("/catas", response_model=list[CataRecord])
def get_catas():
    try:
        return list_catas()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.get("/wines/{codigo_vino}/catas", response_model=list[CataRecord])
def get_wine_catas(codigo_vino: str):
    try:
        return list_catas(codigo_vino)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/wines/{codigo_vino}/catas", response_model=CataRecord)
def add_cata_route(codigo_vino: str, payload: CataCreateInput):
    """Registra una cata sin descontar stock (a diferencia de /consume)."""
    try:
        return add_cata(codigo_vino, payload)
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


@router.put("/catas/{id_cata}", response_model=CataRecord)
def update_cata_route(id_cata: str, payload: CataUpdateInput):
    try:
        return update_cata(id_cata, payload)
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


@router.delete("/catas/{id_cata}")
def delete_cata_route(id_cata: str):
    try:
        return delete_cata(id_cata)
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
