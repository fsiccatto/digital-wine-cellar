from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.scan import router as scan_router
from app.routes.wines import router as wines_router

app = FastAPI(title="Mi Cava Virtual API", version="0.1.0")

app.include_router(health_router)
app.include_router(scan_router)
app.include_router(wines_router)
