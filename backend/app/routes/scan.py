from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.wine_schema import WineScanResult
from app.services.gemini_service import extract_wine_data_from_image_bytes
from app.utils.image_upload import read_validated_image

router = APIRouter(prefix="/api", tags=["scan"])


@router.post("/scan-label", response_model=WineScanResult)
async def scan_label(file: UploadFile = File(...)):
    image_bytes = await read_validated_image(file)

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
