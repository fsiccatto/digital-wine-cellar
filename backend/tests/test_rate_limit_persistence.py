"""Los contadores tienen que sobrevivir un arranque en frio.

Con min-instances=0 la app duerme casi todo el dia: sin esto, cada despertar
regalaba una ventana limpia a quien tuviera el token.
"""

from unittest.mock import patch

import pytest

from app import rate_limit
from app.services import rate_limit_store


@pytest.fixture(autouse=True)
def limpio():
    rate_limit.reset()
    yield
    rate_limit.reset()


def reiniciar_proceso():
    """Simula un arranque en frio: se pierde la memoria, no el bucket."""
    with rate_limit._lock:
        rate_limit._hits.clear()
        rate_limit._loaded = False


class TestSinBucket:
    """En local no hay bucket y nada de esto tiene que activarse."""

    def test_no_se_guarda_nada(self):
        with patch.object(rate_limit_store, "GCS_BUCKET_NAME", ""):
            assert not rate_limit_store.is_enabled()
            assert rate_limit_store.load() == {}
            rate_limit_store.save({"k": [1.0]}, forzar=True)  # no explota

    def test_el_limitador_sigue_andando(self):
        with patch.object(rate_limit_store, "GCS_BUCKET_NAME", ""):
            for _ in range(2):
                assert rate_limit.check("k", limit=2, window_seconds=60)[0]
            assert not rate_limit.check("k", limit=2, window_seconds=60)[0]


class TestSobreviveElReinicio:
    def test_el_cupo_gastado_se_recupera(self):
        guardado = {}

        def fake_save(estado, forzar=False):
            guardado.clear()
            guardado.update(estado)

        with (
            patch.object(rate_limit_store, "save", side_effect=fake_save),
            patch.object(rate_limit_store, "load", side_effect=lambda: dict(guardado)),
        ):
            for _ in range(3):
                rate_limit.check("ip", limit=3, window_seconds=900)

            # El proceso muere y arranca de nuevo.
            reiniciar_proceso()

            permitido, _ = rate_limit.check("ip", limit=3, window_seconds=900)

        assert not permitido, "tras el reinicio el cupo volvio a cero"

    def test_las_marcas_viejas_no_cuentan(self):
        import time

        # Estado de hace una hora, con una ventana de 15 minutos.
        viejo = {"ip": [time.time() - 3600]}

        with (
            patch.object(rate_limit_store, "load", return_value=viejo),
            patch.object(rate_limit_store, "save"),
        ):
            reiniciar_proceso()
            permitido, _ = rate_limit.check("ip", limit=1, window_seconds=900)

        assert permitido, "una marca vencida no deberia gastar cupo"

    def test_lo_de_este_proceso_le_gana_a_lo_guardado(self):
        import time

        ahora = time.time()

        with patch.object(rate_limit_store, "save"):
            rate_limit.check("ip", limit=5, window_seconds=900)

        with (
            patch.object(rate_limit_store, "load", return_value={"ip": [ahora - 1]}),
            patch.object(rate_limit_store, "save"),
        ):
            # Ya cargado: una segunda lectura no pisa lo que hay en memoria.
            rate_limit.check("ip", limit=5, window_seconds=900)

        assert len(rate_limit._hits["ip"]) == 2


class TestNuncaRompeUnPedido:
    def test_con_el_bucket_caido_el_limite_sigue_funcionando(self):
        # Lo que no puede pasar es que un bucket caido tire abajo la API.
        from app.services import storage_service

        with (
            patch.object(rate_limit_store, "GCS_BUCKET_NAME", "un-bucket"),
            patch.object(storage_service, "get_bucket", side_effect=RuntimeError("sin red")),
        ):
            reiniciar_proceso()
            for _ in range(2):
                assert rate_limit.check("ip", limit=2, window_seconds=60)[0]

            permitido, _ = rate_limit.check("ip", limit=2, window_seconds=60)

        assert not permitido, "sin bucket el tope tiene que seguir valiendo"

    def test_el_store_traga_los_errores_de_red(self):
        from app.services import storage_service

        with (
            patch.object(rate_limit_store, "GCS_BUCKET_NAME", "un-bucket"),
            patch.object(storage_service, "get_bucket", side_effect=RuntimeError("sin red")),
        ):
            assert rate_limit_store.load() == {}
            rate_limit_store.save({"k": [1.0]}, forzar=True)

    def test_un_json_corrupto_no_rompe(self):
        from app.services import storage_service

        blob = patch.object(storage_service, "get_bucket").start()
        blob.return_value.blob.return_value.download_as_bytes.return_value = b"{ no json"

        with patch.object(rate_limit_store, "GCS_BUCKET_NAME", "un-bucket"):
            assert rate_limit_store.load() == {}

        patch.stopall()

    def test_se_descarta_lo_que_no_tiene_forma(self):
        from app.services import storage_service

        basura = b'{"ok": [1.5, 2.5], "mal": "no es lista", "mixto": [1.0, "x"]}'
        bucket = patch.object(storage_service, "get_bucket").start()
        bucket.return_value.blob.return_value.download_as_bytes.return_value = basura

        with patch.object(rate_limit_store, "GCS_BUCKET_NAME", "un-bucket"):
            datos = rate_limit_store.load()

        patch.stopall()
        assert datos == {"ok": [1.5, 2.5], "mixto": [1.0]}


class TestEscrituraEspaciada:
    def test_no_se_escribe_en_cada_pedido(self):
        from app.services import storage_service

        bucket = patch.object(storage_service, "get_bucket").start()

        with patch.object(rate_limit_store, "GCS_BUCKET_NAME", "un-bucket"):
            rate_limit_store.reset()
            for _ in range(10):
                rate_limit_store.save({"k": [1.0]})

        subidas = bucket.return_value.blob.return_value.upload_from_string.call_count
        patch.stopall()
        # Sin el piso, rotar IPs generaria una escritura por intento.
        assert subidas == 1


class TestElBloqueoSeGuardaSiempre:
    """La escritura espaciada pierde los intermedios; el agotamiento no."""

    def test_agotar_el_cupo_fuerza_la_escritura(self):
        with patch.object(rate_limit_store, "save") as guardar:
            for _ in range(3):
                rate_limit.check("ip", limit=3, window_seconds=60)

        forzados = [c for c in guardar.call_args_list if c.kwargs.get("forzar")]
        assert len(forzados) == 1, "solo el intento que agota el cupo fuerza"

    def test_los_intentos_de_antes_no_fuerzan(self):
        with patch.object(rate_limit_store, "save") as guardar:
            for _ in range(2):
                rate_limit.check("ip", limit=5, window_seconds=60)

        assert not any(c.kwargs.get("forzar") for c in guardar.call_args_list)

    def test_el_bloqueo_sobrevive_al_reinicio(self):
        guardado = {}

        def fake_save(estado, forzar=False):
            # Solo lo forzado llega al bucket: simula que el espaciado
            # descarta el resto.
            if forzar:
                guardado.clear()
                guardado.update(estado)

        with (
            patch.object(rate_limit_store, "save", side_effect=fake_save),
            patch.object(rate_limit_store, "load", side_effect=lambda: dict(guardado)),
        ):
            for _ in range(3):
                rate_limit.check("ip", limit=3, window_seconds=900)

            reiniciar_proceso()
            permitido, _ = rate_limit.check("ip", limit=3, window_seconds=900)

        assert not permitido, "el bloqueo tiene que sobrevivir aunque se pierdan los intermedios"
