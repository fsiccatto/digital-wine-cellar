from io import BytesIO
from fastapi.testclient import TestClient
from PIL import Image
from unittest.mock import patch

from app.main import app

client = TestClient(app)


def test_scan_label_requires_image():
    response = client.post("/api/scan-label")
    assert response.status_code == 422


def test_scan_label_rejects_non_image_content():
    response = client.post(
        "/api/scan-label",
        files={"file": ("label.jpg", b"not-an-image", "image/jpeg")},
    )
    assert response.status_code == 400


def test_scan_label_rejects_oversized_image():
    with patch("app.utils.image_upload.MAX_IMAGE_SIZE_BYTES", 3):
        response = client.post(
            "/api/scan-label",
            files={"file": ("label.jpg", b"1234", "image/jpeg")},
        )
    assert response.status_code == 413


def test_scan_label_accepts_valid_image():
    image_buffer = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(image_buffer, format="JPEG")

    with patch(
        "app.routes.scan.extract_wine_data_from_image_bytes",
        return_value={"bodega": "Trapiche", "nombre_vino": "Fond de Cave"},
    ):
        response = client.post(
            "/api/scan-label",
            files={"file": ("label.jpg", image_buffer.getvalue(), "image/jpeg")},
        )

    assert response.status_code == 200
    assert response.json()["bodega"] == "Trapiche"


def test_scan_label_sobrevive_a_tipos_raros_del_modelo():
    """El caso que rompio en produccion: 500 mudo y la botella a mano.

    Gemini devolvio el JSON bien formado pero con tipos que no eran los del
    prompt. El modelo se armaba FUERA del try, asi que el ValidationError no lo
    agarraba nadie y se perdian tambien los campos que si estaban bien.
    """
    image_buffer = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(image_buffer, format="JPEG")

    with patch(
        "app.routes.scan.extract_wine_data_from_image_bytes",
        return_value={
            "bodega": "Catena Zapata",
            "nombre_vino": "Adrianna",
            "varietal": ["Malbec", "Cabernet Franc"],
            "anada": "N/V",
            "region": "Mendoza",
            "alcohol": 13.5,
        },
    ):
        response = client.post(
            "/api/scan-label",
            files={"file": ("label.jpg", image_buffer.getvalue(), "image/jpeg")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["bodega"] == "Catena Zapata"
    assert body["varietal"] == "Malbec & Cabernet Franc"
    assert body["alcohol"] == "13.5"
    # La añada ilegible se pierde sola, sin llevarse el resto del escaneo.
    assert body["anada"] is None
