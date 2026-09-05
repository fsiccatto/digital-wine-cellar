from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app import config, rate_limit
from app.auth import client_ip
from app.schemas.wine_schema import WineScanResult
from app.services.gemini_service import extract_wine_data_from_image_bytes
from app.utils.image_upload import read_validated_image

router = APIRouter(prefix="/api", tags=["scan"])


@router.post("/scan-label", response_model=WineScanResult)
async def scan_label(request: Request, file: UploadFile = File(...)):
    # Cada scan es una llamada paga a Gemini. Con el token filtrado, sin este
    # tope alguien quema la cuota entera (y la alerta de gasto) en minutos.
    permitido, retry_after = rate_limit.check(
        f"scan:{client_ip(request)}",
        limit=config.SCAN_RATE_LIMIT,
        window_seconds=config.SCAN_RATE_WINDOW_SECONDS,
    )
    if not permitido:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados escaneos seguidos. Probá más tarde.",
            headers={"Retry-After": str(retry_after)},
        )

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
