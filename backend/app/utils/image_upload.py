"""Validación compartida de las imágenes que llegan por upload."""

from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.config import MAX_IMAGE_SIZE_BYTES


async def read_validated_image(file: UploadFile) -> bytes:
    """Devuelve los bytes de la imagen o corta con el 4xx que corresponda."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen válida.",
        )

    image_bytes = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen está vacía.",
        )
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen supera el tamaño máximo permitido.",
        )

    # No basta con el content_type declarado: se verifica el contenido real.
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no contiene una imagen válida.",
        ) from exc

    return image_bytes
