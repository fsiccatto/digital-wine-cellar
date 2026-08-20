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
        row = create_wine(payload)
        return WineRecord(**row)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@router.post("/wines/{wine_id}/consume")
def consume_wine_route(wine_id: str, payload: WineConsumeInput):
    try:
        return consume_wine(wine_id, payload)
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
