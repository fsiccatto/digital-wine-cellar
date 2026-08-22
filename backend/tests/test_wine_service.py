from datetime import datetime
from unittest.mock import patch

from app.schemas.wine_schema import WineConsumeInput, WineCreateInput
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
    with patch.object(wine_service, "append_inventory_row") as append_row:
        result = wine_service.create_wine(wine_payload())

    assert result["codigo_vino"].startswith("VINO-TRA-FON-MAL-2020-")
    assert len(result["codigo_vino"]) == 26
    datetime.fromisoformat(result["fecha_ingreso"])
    append_row.assert_called_once_with(result)


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