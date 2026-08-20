from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.wine_schema import WineScanResult
from app.services.gemini_service import extract_wine_data_from_image_bytes

router = APIRouter(prefix="/api", tags=["scan"])


@router.post("/scan-label", response_model=WineScanResult)
async def scan_label(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen válida.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen está vacía.",
        )

    try:
        data = extract_wine_data_from_image_bytes(image_bytes, mime_type=file.content_type)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return WineScanResult(**data)
