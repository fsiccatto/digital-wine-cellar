from unittest.mock import patch

from fastapi.testclient import TestClient

from app import config
from app.config import CORS_ALLOW_ORIGINS
from app.main import app

client = TestClient(app)

TOKEN = "clave-de-prueba"


def test_health_stays_open():
    # La plataforma consulta /health sin credenciales.
    with patch.object(config, "APP_TOKEN", TOKEN):
        assert client.get("/health").status_code == 200


def test_request_without_token_is_rejected():
    with patch.object(config, "APP_TOKEN", TOKEN):
        assert client.get("/api/wines").status_code == 401


def test_wrong_token_is_rejected():
    with patch.object(config, "APP_TOKEN", TOKEN):
        response = client.get("/api/wines", headers={"X-App-Token": "otra-cosa"})

    assert response.status_code == 401


def test_valid_token_reaches_the_route():
    with (
        patch.object(config, "APP_TOKEN", TOKEN),
        patch("app.routes.wines.list_wines", return_value=[]) as listed,
    ):
        response = client.get("/api/wines", headers={"X-App-Token": TOKEN})

    assert response.status_code == 200
    listed.assert_called_once()


def test_bad_body_without_token_is_401_not_422():
    # Como dependencia de router el esquema se validaba primero y respondia 422,
    # revelando la forma del cuerpo a quien no esta autenticado.
    with patch.object(config, "APP_TOKEN", TOKEN):
        response = client.post("/api/wines", json={"bodega": "X"})

    assert response.status_code == 401


def test_rejection_keeps_cors_headers():
    # Sin las cabeceras de CORS el navegador esconde el 401 y no se ve el motivo.
    with patch.object(config, "APP_TOKEN", TOKEN):
        response = client.get(
            "/api/wines", headers={"Origin": CORS_ALLOW_ORIGINS[0]}
        )

    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == CORS_ALLOW_ORIGINS[0]


def test_preflight_needs_no_token():
    # El navegador manda el preflight sin cabeceras propias.
    with patch.object(config, "APP_TOKEN", TOKEN):
        response = client.options(
            "/api/wines",
            headers={
                "Origin": CORS_ALLOW_ORIGINS[0],
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "x-app-token",
            },
        )

    assert response.status_code == 200
    assert "x-app-token" in response.headers["access-control-allow-headers"].lower()


def test_open_api_when_no_token_configured():
    # Sin APP_TOKEN (desarrollo local) no se exige nada.
    with (
        patch.object(config, "APP_TOKEN", ""),
        patch("app.routes.wines.list_wines", return_value=[]),
    ):
        assert client.get("/api/wines").status_code == 200
