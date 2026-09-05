"""Guarda los contadores de uso para que sobrevivan un arranque en frio.

Con `min-instances=0` la app duerme casi todo el dia, asi que los arranques en
frio son frecuentes y cada uno borraba los contadores: quien tuviera el token
podia esperar uno y arrancar con la ventana limpia.

Se usa el bucket que ya existe para las fotos, con las credenciales que ya
estan cargadas. Firestore seria la herramienta "correcta", pero significa una
API nueva, una base que despues no se puede sacar del proyecto y una
dependencia mas en el camino del pedido; un objeto JSON en un bucket que ya
esta hace exactamente lo mismo para un solo proceso.

Nada de esto puede romper un pedido: si el bucket no responde, se sigue con los
contadores en memoria, que es como venia funcionando.
"""

import json
import logging
import threading
import time

from app.config import GCS_BUCKET_NAME
from app.services import storage_service

logger = logging.getLogger(__name__)

OBJECT_NAME = "estado/rate-limit.json"

# Cada cuanto se baja el estado al bucket. Escribir en cada pedido dejaria el
# gasto en manos de quien ataca: sin este piso, rotar IPs genera una escritura
# por intento. Perder hasta un minuto de cuentas si el proceso muere es peor
# que nada y mucho mejor que perderlas todas.
SAVE_INTERVAL_SECONDS = 60.0

_lock = threading.Lock()
_last_save = 0.0


def is_enabled() -> bool:
    """Sin bucket (desarrollo local) no se persiste nada."""
    return bool(GCS_BUCKET_NAME)


def load() -> dict[str, list[float]]:
    """Estado guardado, o vacio si no hay o no se puede leer."""
    if not is_enabled():
        return {}

    try:
        blob = storage_service.get_bucket().blob(OBJECT_NAME)
        crudo = blob.download_as_bytes()
    except Exception as exc:  # noqa: BLE001 - nunca romper por esto
        # Lo normal la primera vez es que el objeto no exista.
        logger.info("Sin estado de limites guardado (%s)", type(exc).__name__)
        return {}

    try:
        datos = json.loads(crudo)
    except (ValueError, TypeError):
        logger.warning("El estado de limites guardado no es JSON valido, se ignora.")
        return {}

    if not isinstance(datos, dict):
        return {}

    # Se valida lo que vuelve: el archivo lo pudo tocar cualquiera con acceso
    # al bucket, y una lista de timestamps rota tiraria abajo cada pedido.
    limpio: dict[str, list[float]] = {}
    for clave, marcas in datos.items():
        if not isinstance(clave, str) or not isinstance(marcas, list):
            continue
        validas = [m for m in marcas if isinstance(m, (int, float))]
        if validas:
            limpio[clave] = validas
    return limpio


def save(estado: dict[str, list[float]], forzar: bool = False) -> None:
    """Baja el estado al bucket, como mucho una vez cada SAVE_INTERVAL_SECONDS."""
    global _last_save

    if not is_enabled():
        return

    ahora = time.time()
    with _lock:
        if not forzar and ahora - _last_save < SAVE_INTERVAL_SECONDS:
            return
        _last_save = ahora

    try:
        storage_service.get_bucket().blob(OBJECT_NAME).upload_from_string(
            json.dumps(estado), content_type="application/json"
        )
    except Exception as exc:  # noqa: BLE001 - nunca romper por esto
        logger.warning("No se pudo guardar el estado de limites: %s", exc)


def reset() -> None:
    """Solo para los tests."""
    global _last_save
    _last_save = 0.0
