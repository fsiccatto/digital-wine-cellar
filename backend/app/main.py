from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ALLOW_ORIGINS
from app.routes.health import router as health_router
from app.routes.scan import router as scan_router
from app.routes.wines import router as wines_router

app = FastAPI(title="Mi Cava Virtual API", version="0.1.0")

# El frontend publicado corre en otro dominio que este backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(health_router)
app.include_router(scan_router)
app.include_router(wines_router)
