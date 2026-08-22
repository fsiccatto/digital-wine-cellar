from fastapi import APIRouter, HTTPException, status

from app.schemas.wine_schema import WineConsumeInput, WineCreateInput, WineRecord
from app.services.wine_service import consume_wine, create_wine, list_wines

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


@router.post("/wines", response_model=WineRecord)
def create_new_wine(payload: WineCreateInput):
    try:
        return create_wine(payload)
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
