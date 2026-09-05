"""Los topes de uso: fuerza bruta contra el token y abuso de la cuota de Gemini."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app import config, rate_limit
from app.main import app

client = TestClient(app)

TOKEN = "clave-de-prueba"


@pytest.fixture(autouse=True)
def contador_limpio():
    rate_limit.reset()
    yield
    rate_limit.reset()


class TestVentanaDeslizante:
    def test_deja_pasar_hasta_el_limite(self):
        for _ in range(3):
            permitido, _ = rate_limit.check("k", limit=3, window_seconds=60)
            assert permitido

        permitido, retry_after = rate_limit.check("k", limit=3, window_seconds=60)
        assert not permitido
        assert 0 < retry_after <= 61

    def test_las_claves_no_se_pisan(self):
        rate_limit.check("uno", limit=1, window_seconds=60)

        permitido, _ = rate_limit.check("otro", limit=1, window_seconds=60)
        assert permitido

    def test_la_ventana_libera_al_vencer(self):
        import time

        rate_limit.check("k", limit=1, window_seconds=60)

        # Se viaja en el tiempo en vez de dormir 60 segundos. El salto es
        # relativo: monotonic() ya arranca alto y un valor fijo iria al pasado.
        futuro = time.monotonic() + 61
        with patch("app.rate_limit.time.monotonic", return_value=futuro):
            permitido, _ = rate_limit.check("k", limit=1, window_seconds=60)

        assert permitido

    def test_peek_no_gasta_cupo(self):
        for _ in range(5):
            permitido, _ = rate_limit.check("k", limit=2, window_seconds=60, peek=True)
            assert permitido

        # Las cinco consultas no consumieron nada: el cupo real sigue entero.
        assert rate_limit.check("k", limit=2, window_seconds=60)[0]
        assert rate_limit.check("k", limit=2, window_seconds=60)[0]
        assert not rate_limit.check("k", limit=2, window_seconds=60)[0]


class TestFuerzaBruta:
    def test_los_intentos_fallidos_terminan_en_429(self):
        with (
            patch.object(config, "APP_TOKEN", TOKEN),
            patch.object(config, "AUTH_FAIL_LIMIT", 3),
        ):
            for _ in range(3):
                assert client.get(
                    "/api/wines", headers={"X-App-Token": "mal"}
                ).status_code == 401

            respuesta = client.get("/api/wines", headers={"X-App-Token": "mal"})

        assert respuesta.status_code == 429
        assert "Retry-After" in respuesta.headers

    def test_el_bloqueo_no_se_sortea_acertando_despues(self):
        # Una vez bloqueada la IP, ni la clave correcta pasa: si no, bastaria
        # con seguir probando hasta dar con ella.
        with (
            patch.object(config, "APP_TOKEN", TOKEN),
            patch.object(config, "AUTH_FAIL_LIMIT", 2),
        ):
            for _ in range(2):
                client.get("/api/wines", headers={"X-App-Token": "mal"})

            respuesta = client.get("/api/wines", headers={"X-App-Token": TOKEN})

        assert respuesta.status_code == 429

    def test_el_token_correcto_nunca_se_bloquea(self):
        # Solo los fallos gastan cupo: el uso normal no se corta jamas.
        with (
            patch.object(config, "APP_TOKEN", TOKEN),
            patch.object(config, "AUTH_FAIL_LIMIT", 3),
            patch("app.routes.wines.list_wines", return_value=[]),
        ):
            for _ in range(10):
                respuesta = client.get("/api/wines", headers={"X-App-Token": TOKEN})
                assert respuesta.status_code == 200

    def test_cada_ip_tiene_su_propio_cupo(self):
        with (
            patch.object(config, "APP_TOKEN", TOKEN),
            patch.object(config, "AUTH_FAIL_LIMIT", 2),
        ):
            for _ in range(2):
                client.get(
                    "/api/wines",
                    headers={"X-App-Token": "mal", "X-Forwarded-For": "1.1.1.1"},
                )

            # Otra IP no arrastra el bloqueo de la primera.
            respuesta = client.get(
                "/api/wines",
                headers={"X-App-Token": "mal", "X-Forwarded-For": "2.2.2.2"},
            )

        assert respuesta.status_code == 401

    def test_solo_cuenta_la_primera_ip_reenviada(self):
        # El resto de X-Forwarded-For lo puede inventar quien llama; si contara,
        # se esquivaria el limite agregando IPs falsas a la izquierda.
        with (
            patch.object(config, "APP_TOKEN", TOKEN),
            patch.object(config, "AUTH_FAIL_LIMIT", 2),
        ):
            for _ in range(2):
                client.get(
                    "/api/wines",
                    headers={"X-App-Token": "mal", "X-Forwarded-For": "9.9.9.9, 1.1.1.1"},
                )

            respuesta = client.get(
                "/api/wines",
                headers={"X-App-Token": "mal", "X-Forwarded-For": "9.9.9.9, 7.7.7.7"},
            )

        assert respuesta.status_code == 429

    def test_health_no_se_bloquea(self):
        # La plataforma lo consulta seguido y no manda token.
        with (
            patch.object(config, "APP_TOKEN", TOKEN),
            patch.object(config, "AUTH_FAIL_LIMIT", 2),
        ):
            for _ in range(10):
                assert client.get("/health").status_code == 200


class TestCuotaDeScan:
    def _imagen(self):
        from io import BytesIO

        from PIL import Image

        buffer = BytesIO()
        Image.new("RGB", (10, 10)).save(buffer, format="JPEG")
        return buffer.getvalue()

    def test_pasado_el_tope_no_se_llama_a_gemini(self):
        imagen = self._imagen()
        datos = {
            "bodega": None, "nombre_vino": None, "varietal": None,
            "anada": None, "region": None, "alcohol": None,
        }

        with (
            patch.object(config, "APP_TOKEN", ""),
            patch.object(config, "SCAN_RATE_LIMIT", 2),
            patch(
                "app.routes.scan.extract_wine_data_from_image_bytes",
                return_value=datos,
            ) as gemini,
        ):
            for _ in range(2):
                assert client.post(
                    "/api/scan-label",
                    files={"file": ("e.jpg", imagen, "image/jpeg")},
                ).status_code == 200

            respuesta = client.post(
                "/api/scan-label", files={"file": ("e.jpg", imagen, "image/jpeg")}
            )

        assert respuesta.status_code == 429
        # Lo que se protege es la cuota: la tercera no debe llegar a Gemini.
        assert gemini.call_count == 2
