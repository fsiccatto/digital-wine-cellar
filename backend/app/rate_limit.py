"""Limites de uso en memoria.

El estado vive en el proceso, asi que el servicio corre con max-instances=1
(ver infra/terraform): con dos instancias cada una llevaria su propio contador
y el tope real se duplicaria.

Los contadores se bajan a un objeto en el bucket cada tanto y se releen al
arrancar, asi un arranque en frio ya no regala una ventana limpia (ver
services/rate_limit_store.py). Si el bucket no esta o falla, se sigue solo en
memoria.

Para una cava de una persona alcanza: no es una defensa contra un atacante
distribuido, es un tope para que un token filtrado no queme la cuota de Gemini
ni permita probar claves de a miles. Un contador compartido (Firestore, Redis)
sobreviviria el arranque en frio, al precio de una dependencia mas en el
camino de cada pedido.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from app.services import rate_limit_store

# Ventana deslizante por clave. Cada valor es la cola de timestamps de los
# intentos que todavia estan dentro de la ventana.
_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()

# Se lee el estado guardado una sola vez, en el primer pedido: hacerlo al
# importar rompe los tests y retrasa el arranque por algo que puede fallar.
_loaded = False

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
    # Reloj de pared, no monotonic: las marcas se guardan y se releen en otro
    # proceso, donde el reloj monotonico arranca de cero y no significa nada.
    now = time.time()

    _ensure_loaded()

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
        instantanea = {k: list(b) for k, b in _hits.items() if b}
        # Este intento fue el que agoto el cupo. Es el unico estado que no se
        # puede perder: con la escritura espaciada, los intermedios se pierden
        # y tras un arranque en frio se recupera parte del cupo, pero "esta
        # clave quedo sin cupo" tiene que quedar grabado si o si. Pasa una vez
        # por ventana, asi que no dispara escrituras de mas.
        recien_agotado = len(bucket) >= limit

    # Fuera del lock: guardar habla con la red y no vale la pena bloquear al
    # resto de los pedidos por eso. El store decide si toca escribir.
    rate_limit_store.save(instantanea, forzar=recien_agotado)
    return True, 0


def _ensure_loaded() -> None:
    """Trae el estado guardado la primera vez que se consulta algo."""
    global _loaded
    if _loaded:
        return

    with _lock:
        if _loaded:
            return
        _loaded = True
        guardado = rate_limit_store.load()

    if not guardado:
        return

    with _lock:
        for clave, marcas in guardado.items():
            # Lo que ya estaba en memoria gana: es de este proceso y es mas
            # nuevo que cualquier cosa que estuviera en el bucket.
            if not _hits[clave]:
                _hits[clave].extend(sorted(marcas))


def _evict_stale(now: float, window_seconds: float) -> None:
    vacias = [k for k, b in _hits.items() if not b or now - b[-1] >= window_seconds]
    for k in vacias:
        del _hits[k]


def reset() -> None:
    """Solo para los tests: cada uno arranca con el contador limpio."""
    global _loaded
    with _lock:
        _hits.clear()
        _loaded = False
    rate_limit_store.reset()
