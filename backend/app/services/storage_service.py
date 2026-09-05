"""Guarda las fotos de etiqueta en Google Cloud Storage.

El bucket es privado: en el Sheet se guarda el nombre del objeto y las URLs de
lectura se firman on demand, para no publicar un link permanente.
"""

import os
import re
from datetime import timedelta
from functools import lru_cache

from google.api_core import exceptions as gcloud_exceptions
from google.cloud import storage
from google.oauth2 import service_account

from app.config import (
    GCS_BUCKET_NAME,
    GCS_SIGNED_URL_TTL_SECONDS,
    GOOGLE_SHEETS_CREDENTIALS_FILE,
)

EXTENSION_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
}


class StorageNotConfigured(RuntimeError):
    """El bucket no está configurado: la app sigue andando sin fotos."""


def is_configured() -> bool:
    return bool(GCS_BUCKET_NAME)


@lru_cache(maxsize=1)
def _get_bucket():
    if not GCS_BUCKET_NAME:
        raise StorageNotConfigured(
            "Falta GCS_BUCKET_NAME en el entorno: no se pueden guardar fotos."
        )
    if not os.path.exists(GOOGLE_SHEETS_CREDENTIALS_FILE):
        raise FileNotFoundError(
            f"No se encontró el archivo de credenciales: {GOOGLE_SHEETS_CREDENTIALS_FILE}."
        )

    # Se firma con la clave privada del Service Account, así que se usan las
    # mismas credenciales que Sheets en lugar de las del entorno.
    credentials = service_account.Credentials.from_service_account_file(
        GOOGLE_SHEETS_CREDENTIALS_FILE
    )
    client = storage.Client(credentials=credentials, project=credentials.project_id)
    return client.bucket(GCS_BUCKET_NAME)


# Los codigos que arma build_wine_code son BOD-VAR-2020-0001: solo mayusculas,
# digitos y guiones. Nada que pueda salirse del prefijo "etiquetas/".
CODIGO_VALIDO = re.compile(r"[A-Za-z0-9_-]{1,64}$")


def build_object_name(codigo_vino: str, content_type: str) -> str:
    """Arma la ruta del objeto, rechazando cualquier codigo raro.

    Hoy el unico camino hasta aca valida el codigo contra el Sheet antes de
    llamar, asi que esto no cierra un agujero abierto: fija la garantia en el
    lugar donde se construye la ruta, para que no dependa de que todas las
    filas del Sheet esten bien formadas ni de quien llame manana.
    """
    if not CODIGO_VALIDO.fullmatch(codigo_vino or ""):
        raise ValueError(f"Codigo de vino invalido para un nombre de objeto: {codigo_vino!r}")

    extension = EXTENSION_BY_MIME.get(content_type, ".jpg")
    return f"etiquetas/{codigo_vino}{extension}"


def upload_label_photo(codigo_vino: str, image_bytes: bytes, content_type: str) -> str:
    """Sube la foto y devuelve el nombre del objeto guardado en el Sheet."""
    object_name = build_object_name(codigo_vino, content_type)
    blob = _get_bucket().blob(object_name)
    blob.upload_from_string(image_bytes, content_type=content_type)
    return object_name


def build_signed_url(object_name: str) -> str | None:
    """URL de lectura temporal. Devuelve None si la foto ya no está."""
    if not object_name:
        return None

    try:
        return _get_bucket().blob(object_name).generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=GCS_SIGNED_URL_TTL_SECONDS),
            method="GET",
        )
    except gcloud_exceptions.NotFound:
        return None


def delete_label_photo(object_name: str) -> None:
    if not object_name:
        return
    try:
        _get_bucket().blob(object_name).delete()
    except gcloud_exceptions.NotFound:
        pass
