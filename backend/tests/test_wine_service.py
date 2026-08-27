from datetime import datetime
from unittest.mock import patch

import pytest

from app.schemas.wine_schema import WineConsumeInput, WineCreateInput, WineUpdateInput
from app.services import wine_service


def wine_payload():
    return WineCreateInput(
        bodega="Trapiche",
        nombre_vino="Fond de Cave",
        varietal="Malbec",
        anada=2020,
        region="Mendoza",
        alcohol="14%",
    )


def test_create_wine_generates_code_and_system_date():
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=[]),
        patch.object(wine_service, "append_inventory_row") as append_row,
    ):
        result = wine_service.create_wine(wine_payload())

    assert result.codigo_vino == "TRA-MAL-2020-0001"
    datetime.fromisoformat(result.fecha_ingreso)
    persisted = append_row.call_args.args[0]
    assert persisted["codigo_vino"] == "TRA-MAL-2020-0001"
    assert persisted["precio_estimado"] == ""


def test_consume_wine_uses_code_and_system_date():
    rows = [{"id": "internal-uuid", "codigo_vino": "VINO-ABCD1234", "cantidad": "1"}]
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=rows),
        patch.object(wine_service, "update_inventory_quantity") as update_quantity,
        patch.object(wine_service, "append_cata_record") as append_cata,
    ):
        result = wine_service.consume_wine("VINO-ABCD1234", WineConsumeInput(puntuacion=5))

    assert result == {"status": "ok", "stock_restante": 0}
    update_quantity.assert_called_once_with("VINO-ABCD1234", 0)
    cata = append_cata.call_args.args[0]
    assert cata["vino_id"] == "VINO-ABCD1234"
    datetime.fromisoformat(cata["fecha_consumo"])

def inventory_row(codigo="TRA-MAL-2020-0001", **overrides):
    row = {
        "id": "internal-uuid",
        "codigo_vino": codigo,
        "fecha_ingreso": "2026-01-01T10:00:00",
        "bodega": "Trapiche",
        "nombre_vino": "Fond de Cave",
        "varietal": "Malbec",
        "anada": "2020",
        "region": "Mendoza",
        "alcohol": "14%",
        "cantidad": "3",
        "ubicacion": "Estante A",
        "precio_estimado": "32000",
        "foto_url": "etiquetas/foto.jpg",
    }
    row.update(overrides)
    return row


def update_payload():
    return WineUpdateInput(
        bodega="Catena Zapata",
        nombre_vino="Adrianna",
        varietal="Cabernet",
        anada=2021,
        region="Gualtallary",
        alcohol="13,5%",
    )


def test_update_wine_keeps_the_code_immutable():
    rows = [inventory_row()]
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=rows),
        patch.object(wine_service, "update_inventory_row") as update_row,
    ):
        result = wine_service.update_wine("TRA-MAL-2020-0001", update_payload())

    # Cambiaron bodega, varietal y añada: el código no se regenera.
    assert result.codigo_vino == "TRA-MAL-2020-0001"
    assert result.bodega == "Catena Zapata"
    assert result.anada == 2021
    # Y tampoco se manda el código como columna a escribir.
    written = update_row.call_args.args[1]
    assert "codigo_vino" not in written
    assert "cantidad" not in written


def test_update_wine_rejects_unknown_code():
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=[]),
        patch.object(wine_service, "update_inventory_row") as update_row,
    ):
        with pytest.raises(ValueError):
            wine_service.update_wine("NO-EXISTE", update_payload())

    update_row.assert_not_called()


def test_delete_wine_removes_photo_but_never_the_catas():
    rows = [inventory_row()]
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=rows),
        patch.object(wine_service, "delete_inventory_row") as delete_row,
        patch.object(wine_service.storage_service, "is_configured", return_value=True),
        patch.object(wine_service.storage_service, "delete_label_photo") as delete_photo,
        patch.object(wine_service, "append_cata_record") as append_cata,
    ):
        result = wine_service.delete_wine("TRA-MAL-2020-0001")

    assert result == {"status": "ok", "codigo_vino": "TRA-MAL-2020-0001"}
    delete_row.assert_called_once_with("TRA-MAL-2020-0001")
    # El nombre del objeto crudo, no una URL firmada.
    delete_photo.assert_called_once_with("etiquetas/foto.jpg")
    append_cata.assert_not_called()


def test_delete_wine_survives_a_failing_bucket():
    rows = [inventory_row()]
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=rows),
        patch.object(wine_service, "delete_inventory_row") as delete_row,
        patch.object(wine_service.storage_service, "is_configured", return_value=True),
        patch.object(
            wine_service.storage_service,
            "delete_label_photo",
            side_effect=RuntimeError("GCS caído"),
        ),
    ):
        result = wine_service.delete_wine("TRA-MAL-2020-0001")

    # Un blob huérfano es barato; una fila fantasma no.
    assert result["status"] == "ok"
    delete_row.assert_called_once()


def test_adjust_stock_does_not_write_a_cata():
    rows = [inventory_row(cantidad="3")]
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=rows),
        patch.object(wine_service, "update_inventory_quantity") as update_quantity,
        patch.object(wine_service, "append_cata_record") as append_cata,
    ):
        result = wine_service.adjust_stock("TRA-MAL-2020-0001", -1)

    assert result.cantidad == 2
    update_quantity.assert_called_once_with("TRA-MAL-2020-0001", 2)
    append_cata.assert_not_called()


def test_adjust_stock_refuses_to_go_negative():
    rows = [inventory_row(cantidad="1")]
    with (
        patch.object(wine_service, "get_inventory_rows", return_value=rows),
        patch.object(wine_service, "update_inventory_quantity") as update_quantity,
    ):
        with pytest.raises(ValueError):
            wine_service.adjust_stock("TRA-MAL-2020-0001", -2)

    update_quantity.assert_not_called()


def test_cata_of_a_deleted_wine_stays_visible_as_orphan():
    catas = [
        {
            "id_cata": "cata-1",
            "vino_id": "TRA-MAL-2020-0001",
            "fecha_consumo": "2026-02-01T21:00:00",
            "puntuacion": "4",
            "notas_cata": "",
            "maridaje": "Cordero",
        },
        {
            "id_cata": "cata-2",
            "vino_id": "BORRADO-VIN-2019-0001",
            "fecha_consumo": "2026-03-01T21:00:00",
            "puntuacion": "5",
            "notas_cata": "",
            "maridaje": "",
        },
    ]
    with (
        patch.object(wine_service, "get_catas_rows", return_value=catas),
        patch.object(wine_service, "get_inventory_rows", return_value=[inventory_row()]),
    ):
        result = wine_service.list_catas()

    # Más nuevas primero: la huérfana es de marzo.
    assert [cata.id_cata for cata in result] == ["cata-2", "cata-1"]

    orphan = result[0]
    assert orphan.vino_existe is False
    assert orphan.nombre_vino is None

    joined = result[1]
    assert joined.vino_existe is True
    assert joined.nombre_vino == "Fond de Cave"
    # La puntuación llega como texto desde el Sheet.
    assert joined.puntuacion == 4
    assert joined.maridaje == "Cordero"


def test_list_catas_filters_by_wine_without_reading_inventory_when_empty():
    with (
        patch.object(wine_service, "get_catas_rows", return_value=[]),
        patch.object(wine_service, "get_inventory_rows") as get_rows,
    ):
        assert wine_service.list_catas("TRA-MAL-2020-0001") == []

    get_rows.assert_not_called()
