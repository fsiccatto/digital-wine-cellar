"""Acceso con un token compartido.

La cava es de una sola persona, asi que no hay cuentas: una clave unica que el
frontend guarda en el celular y manda en cada pedido.

Sin APP_TOKEN configurado la API queda abierta, que es lo comodo en local.
"""

import logging
import os
import secrets

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app import config

# Abiertas para cualquiera: /health lo consulta la plataforma y OPTIONS es el
# preflight de CORS, que el navegador manda sin cabeceras propias.
OPEN_PATHS = {"/health"}

logger = logging.getLogger(__name__)


def verify_token_is_configured() -> None:
    """Aborta el arranque si la API quedaria abierta en produccion.

    Sin APP_TOKEN el middleware deja pasar todo, que es lo comodo en local pero
    seria un desastre silencioso en Cloud Run. `K_SERVICE` la define Cloud Run
    solo, asi que un deploy que olvide la variable falla al levantar en vez de
    publicar la cava entera.
    """
    if config.APP_TOKEN:
        return

    if os.getenv("K_SERVICE"):
        raise RuntimeError(
            "APP_TOKEN esta vacio en Cloud Run: la API quedaria abierta. "
            "Configuralo con --update-secrets=\"APP_TOKEN=app-token:latest\"."
        )

    logger.warning("Sin APP_TOKEN: la API esta ABIERTA. Solo para desarrollo local.")


def _is_valid(token: str | None) -> bool:
    # Comparacion de tiempo constante: un == comun filtra el largo del prefijo
    # coincidente y permite adivinar el token caracter por caracter.
    return bool(token) and secrets.compare_digest(token, config.APP_TOKEN)


async def token_middleware(request: Request, call_next):
    """Corta el pedido antes de que FastAPI valide el cuerpo.

    Como dependencia de router, un POST mal formado devolvia 422 en vez de 401:
    el esquema se valida antes que las dependencias, y eso filtra la forma del
    cuerpo a quien no esta autenticado.
    """
    if (
        config.APP_TOKEN
        and request.url.path not in OPEN_PATHS
        and request.method != "OPTIONS"
        and not _is_valid(request.headers.get("X-App-Token"))
    ):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Token invalido o ausente."},
        )

    return await call_next(request)
