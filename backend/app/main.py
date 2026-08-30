from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import token_middleware, verify_token_is_configured
from app.config import CORS_ALLOW_ORIGINS
from app.routes.health import router as health_router
from app.routes.scan import router as scan_router
from app.routes.wines import router as wines_router

# Antes de exponer nada: si falta el token en produccion, no se levanta.
verify_token_is_configured()

app = FastAPI(title="Mi Cava Virtual API", version="0.1.0")

# El orden importa: los middleware se aplican de adentro hacia afuera, asi que
# este se agrega primero para que CORS quede por fuera y hasta un 401 lleve sus
# cabeceras. Sin eso el navegador esconde la respuesta y no se ve el motivo.
app.middleware("http")(token_middleware)

# El frontend publicado corre en otro dominio que este backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-App-Token"],
)

app.include_router(health_router)
app.include_router(scan_router)
app.include_router(wines_router)
