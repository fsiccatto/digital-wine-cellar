from fastapi.testclient import TestClient

from app.config import CORS_ALLOW_ORIGINS
from app.main import app

client = TestClient(app)


def test_allowed_origin_gets_cors_header():
    origin = CORS_ALLOW_ORIGINS[0]
    response = client.get("/health", headers={"Origin": origin})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_unknown_origin_is_not_allowed():
    response = client.get("/health", headers={"Origin": "https://ajeno.example"})

    # La respuesta llega, pero sin el header el navegador la descarta.
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_preflight_allows_posting_json():
    response = client.options(
        "/api/wines",
        headers={
            "Origin": CORS_ALLOW_ORIGINS[0],
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert "POST" in response.headers["access-control-allow-methods"]


def test_preflight_allows_the_editing_methods():
    """Sin esto el navegador bloquea editar, borrar y ajustar stock.

    TestClient no hace preflight, así que el resto de los tests pasarían igual
    con la config vieja.
    """
    for method in ("PUT", "PATCH", "DELETE"):
        response = client.options(
            "/api/wines/TRA-MAL-2020-0001",
            headers={
                "Origin": CORS_ALLOW_ORIGINS[0],
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "content-type",
            },
        )

        assert response.status_code == 200
        assert method in response.headers["access-control-allow-methods"]
