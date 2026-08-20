from app.main import app


def test_app_exists():
    assert app is not None


def test_health_endpoint():
    response = app.router.routes[0].endpoint()  # type: ignore[attr-defined]
    assert response == {"status": "ok"}
