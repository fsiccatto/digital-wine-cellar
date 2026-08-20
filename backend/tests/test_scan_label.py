from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_scan_label_requires_image():
    response = client.post("/api/scan-label")
    assert response.status_code == 422
