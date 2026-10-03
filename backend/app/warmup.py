"""Abre la planilla y baja los contadores de uso en paralelo al arrancar.

Antes los pagaba el primer pedido, uno detras del otro. Solo en Cloud Run, y
nunca impide el arranque: si algo falla, el pedido lo reintenta solo.
"""

import logging
import os
from concurrent.futures import ThreadPoolExecutor, wait

from app import rate_limit
from app.services import sheets_service

logger = logging.getLogger(__name__)

LIMITE_SEGUNDOS = 5.0


def precalentar() -> None:
    if not os.getenv("K_SERVICE"):
        return

    pool = ThreadPoolExecutor(max_workers=2)
    tareas = {
        "contadores de uso": pool.submit(rate_limit.precargar),
        "planilla": pool.submit(sheets_service.get_inventory_worksheet),
    }
    wait(tareas.values(), timeout=LIMITE_SEGUNDOS)
    pool.shutdown(wait=False)

    for nombre, tarea in tareas.items():
        if not tarea.done():
            logger.warning("Precalentar %s tardo mas de %ss", nombre, LIMITE_SEGUNDOS)
        elif tarea.exception() is not None:
            logger.warning("No se pudo precalentar %s: %s", nombre, tarea.exception())
