from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.wine_schema import CataRecord, WineRecord

client = TestClient(app)

VALID_UPDATE = {
    "bodega": "Catena Zapata",
    "nombre_vino": "Adrianna",
    "varietal": "Cabernet",
    "anada": 2021,
    "region": "Gualtallary",
    "alcohol": "13,5%",
}


def wine_record(**overrides) -> WineRecord:
    data = {
        "id": "internal-uuid",
        "codigo_vino": "TRA-MAL-2020-0001",
        "fecha_ingreso": "2026-01-01T10:00:00",
        "bodega": "Trapiche",
        "nombre_vino": "Fond de Cave",
        "varietal": "Malbec",
        "anada": 2020,
        "region": "Mendoza",
        "alcohol": "14%",
        "cantidad": 3,
    }
    data.update(overrides)
    return WineRecord(**data)


def test_put_unknown_wine_is_404():
    with patch("app.routes.wines.update_wine", side_effect=ValueError("no existe")):
        response = client.put("/api/wines/NO-EXISTE", json=VALID_UPDATE)

    assert response.status_code == 404


def test_put_rejects_a_body_carrying_the_code():
    # extra="forbid": el código es inmutable, mandarlo es un error del cliente.
    body = {**VALID_UPDATE, "codigo_vino": "OTRO-COD-2020-0001"}
    response = client.put("/api/wines/TRA-MAL-2020-0001", json=body)

    assert response.status_code == 422


def test_put_returns_the_updated_wine():
    updated = wine_record(bodega="Catena Zapata", anada=2021)
    with patch("app.routes.wines.update_wine", return_value=updated) as update:
        response = client.put("/api/wines/TRA-MAL-2020-0001", json=VALID_UPDATE)

    assert response.status_code == 200
    assert response.json()["bodega"] == "Catena Zapata"
    assert response.json()["codigo_vino"] == "TRA-MAL-2020-0001"
    update.assert_called_once()


def test_delete_unknown_wine_is_404():
    with patch("app.routes.wines.delete_wine", side_effect=ValueError("no existe")):
        response = client.delete("/api/wines/NO-EXISTE")

    assert response.status_code == 404


def test_delete_returns_the_code():
    result = {"status": "ok", "codigo_vino": "TRA-MAL-2020-0001"}
    with patch("app.routes.wines.delete_wine", return_value=result):
        response = client.delete("/api/wines/TRA-MAL-2020-0001")

    assert response.status_code == 200
    assert response.json() == result


def test_stock_rejects_a_zero_delta():
    response = client.patch("/api/wines/TRA-MAL-2020-0001/stock", json={"delta": 0})

    assert response.status_code == 422


def test_stock_going_negative_is_400():
    with patch("app.routes.wines.adjust_stock", side_effect=ValueError("negativo")):
        response = client.patch("/api/wines/TRA-MAL-2020-0001/stock", json={"delta": -5})

    assert response.status_code == 400


def test_stock_returns_the_new_quantity():
    with patch("app.routes.wines.adjust_stock", return_value=wine_record(cantidad=2)):
        response = client.patch("/api/wines/TRA-MAL-2020-0001/stock", json={"delta": -1})

    assert response.status_code == 200
    assert response.json()["cantidad"] == 2


def test_catas_list_is_served():
    cata = CataRecord(
        id_cata="cata-1",
        vino_id="TRA-MAL-2020-0001",
        fecha_consumo="2026-02-01T21:00:00",
        puntuacion=4,
        vino_existe=True,
        nombre_vino="Fond de Cave",
    )
    with patch("app.routes.wines.list_catas", return_value=[cata]) as list_all:
        response = client.get("/api/catas")

    assert response.status_code == 200
    assert response.json()[0]["nombre_vino"] == "Fond de Cave"
    list_all.assert_called_once_with()


def test_catas_of_one_wine_filter_by_code():
    with patch("app.routes.wines.list_catas", return_value=[]) as list_for_wine:
        response = client.get("/api/wines/TRA-MAL-2020-0001/catas")

    assert response.status_code == 200
    list_for_wine.assert_called_once_with("TRA-MAL-2020-0001")
