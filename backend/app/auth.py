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

from app import config, rate_limit

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


def client_ip(request: Request) -> str:
    """IP del cliente, contando desde el final de X-Forwarded-For.

    La cabecera la arma quien llama y los proxies van AGREGANDO al final, asi
    que las primeras entradas son las que el cliente escribio y las ultimas las
    que puso la infraestructura. Tomar la primera dejaba el limite por IP en
    manos del atacante: mandando una IP inventada distinta en cada pedido, cada
    uno estrenaba cupo. Verificado contra produccion antes de arreglarlo.

    Se cuenta `TRUSTED_PROXY_HOPS` desde el final: en Cloud Run, 1.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        cadena = [parte.strip() for parte in forwarded.split(",") if parte.strip()]
        if cadena:
            # Si vienen menos entradas que saltos esperados, la mas a la
            # izquierda es lo mas confiable que hay.
            indice = max(0, len(cadena) - config.TRUSTED_PROXY_HOPS)
            return cadena[indice]

    return request.client.host if request.client else "desconocido"


async def token_middleware(request: Request, call_next):
    """Corta el pedido antes de que FastAPI valide el cuerpo.

    Como dependencia de router, un POST mal formado devolvia 422 en vez de 401:
    el esquema se valida antes que las dependencias, y eso filtra la forma del
    cuerpo a quien no esta autenticado.
    """
    if (
        not config.APP_TOKEN
        or request.url.path in OPEN_PATHS
        or request.method == "OPTIONS"
    ):
        return await call_next(request)

    ip = client_ip(request)

    # Se consulta antes de comparar: si ya se paso de fallos, ni siquiera se
    # mira la clave, asi el bloqueo no se puede sortear acertando de casualidad.
    permitido, retry_after = rate_limit.check(
        f"auth:{ip}",
        limit=config.AUTH_FAIL_LIMIT,
        window_seconds=config.AUTH_FAIL_WINDOW_SECONDS,
        peek=True,
    )
    if not permitido:
        logger.warning("Demasiados intentos de token fallidos desde %s", ip)
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Demasiados intentos. Probá más tarde."},
            headers={"Retry-After": str(retry_after)},
        )

    if not _is_valid(request.headers.get("X-App-Token")):
        logger.warning(
            "Token invalido desde %s (X-Forwarded-For crudo: %r)",
            ip, request.headers.get("X-Forwarded-For", ""),
        )
        # Solo los fallos gastan cupo: quien tiene la clave nunca se bloquea.
        rate_limit.check(
            f"auth:{ip}",
            limit=config.AUTH_FAIL_LIMIT,
            window_seconds=config.AUTH_FAIL_WINDOW_SECONDS,
        )
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Token invalido o ausente."},
        )

    return await call_next(request)
