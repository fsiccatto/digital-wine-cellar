"""Deja listo lo que el primer pedido necesita mientras el proceso arranca.

Con min-instances=0 casi cada uso de la app es un arranque en frio, y el
primer pedido pagaba todo en fila: bajar del bucket los contadores de uso y
despues autenticarse, abrir la planilla y pedir sus pestañas (~1,1s medido).
Las dos cosas no dependen una de otra, asi que aca van en paralelo y antes de
que el pedido llegue: uvicorn no abre el puerto hasta que termina el arranque,
y Cloud Run le da CPU entera mientras tanto.

Solo en Cloud Run: en local y en los tests no hay planilla que abrir. Y nada
de esto puede impedir el arranque: si algo falla o tarda, el pedido lo vuelve
a intentar por su cuenta como lo hacia siempre.
"""

import logging
import os
from concurrent.futures import ThreadPoolExecutor, wait

from app import rate_limit
from app.services import sheets_service

logger = logging.getLogger(__name__)

# Abrir la planilla tarda ~1s cuando anda bien. Pasado esto conviene dejar
# entrar al pedido en vez de seguir esperando a Google.
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
    # Sin esperar a lo que siga colgado: el pedido se arregla solo.
    pool.shutdown(wait=False)

    for nombre, tarea in tareas.items():
        if not tarea.done():
            logger.warning("Precalentar %s tardo mas de %ss", nombre, LIMITE_SEGUNDOS)
        elif tarea.exception() is not None:
            logger.warning("No se pudo precalentar %s: %s", nombre, tarea.exception())
