"""Limites de uso en memoria.

El estado vive en el proceso, asi que el servicio corre con max-instances=1
(ver infra/deploy.sh): con dos instancias cada una llevaria su propio contador
y el tope real se duplicaria. Lo que queda afuera es el arranque en frio, que
borra los contadores; en el peor caso alguien gana una ventana entera de cupo
justo despues de uno.

Para una cava de una persona alcanza: no es una defensa contra un atacante
distribuido, es un tope para que un token filtrado no queme la cuota de Gemini
ni permita probar claves de a miles. Un contador compartido (Firestore, Redis)
sobreviviria el arranque en frio, al precio de una dependencia mas en el
camino de cada pedido.
"""

import time
from collections import defaultdict, deque
from threading import Lock

# Ventana deslizante por clave. Cada valor es la cola de timestamps de los
# intentos que todavia estan dentro de la ventana.
_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()

# Cuantas claves distintas se recuerdan. Sin tope, un atacante que rota IPs
# hace crecer el dict hasta quedarse con la memoria de la instancia.
MAX_TRACKED_KEYS = 10_000


def _prune(bucket: deque, now: float, window_seconds: float) -> None:
    while bucket and now - bucket[0] >= window_seconds:
        bucket.popleft()


def check(
    key: str, limit: int, window_seconds: float, peek: bool = False
) -> tuple[bool, int]:
    """Registra un intento. Devuelve (permitido, segundos_para_reintentar).

    Con `peek` solo consulta el estado y no gasta cupo: sirve para preguntar
    si una clave ya esta bloqueada antes de decidir si el intento cuenta.
    """
    now = time.monotonic()

    with _lock:
        bucket = _hits[key]
        _prune(bucket, now, window_seconds)

        if len(bucket) >= limit:
            # El mas viejo es el que libera el proximo lugar.
            retry_after = int(window_seconds - (now - bucket[0])) + 1
            return False, retry_after

        if peek:
            return True, 0

        # Se limpia solo cuando hace falta: recorrer todo en cada pedido seria
        # peor que el problema que evita.
        if len(_hits) > MAX_TRACKED_KEYS:
            _evict_stale(now, window_seconds)

        bucket.append(now)
        return True, 0


def _evict_stale(now: float, window_seconds: float) -> None:
    vacias = [k for k, b in _hits.items() if not b or now - b[-1] >= window_seconds]
    for k in vacias:
        del _hits[k]


def reset() -> None:
    """Solo para los tests: cada uno arranca con el contador limpio."""
    with _lock:
        _hits.clear()
