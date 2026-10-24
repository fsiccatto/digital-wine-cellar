from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.wine_schema import PendienteInput
from app.services import pendiente_service, storage_service
from app.services.sheets_service import PENDIENTES_HEADERS

client = TestClient(app)


def pendiente_row(**overrides):
    row = {header: "" for header in PENDIENTES_HEADERS}
    row.update(
        {
            "id": "pend-uuid",
            "fecha_alta": "2026-10-01T21:00:00",
            "nombre_vino": "Gran Enemigo Gualtallary",
            "bodega": "El Enemigo",
            "origen": "Cena en lo de Ana",
        }
    )
    row.update(overrides)
    return row


def como_values(*rows):
    return [PENDIENTES_HEADERS, *[[row[h] for h in PENDIENTES_HEADERS] for row in rows]]


INVENTARIO = [
    ["id", "codigo_vino", "foto_url"],
    ["vino-uuid", "ELE-CAB-2019-0001", ""],
    ["otro-uuid", "TRA-MAL-2020-0001", "etiquetas/TRA-MAL-2020-0001.jpg"],
]


def test_alcanza_con_el_nombre():
    """Lo recomendado de palabra no trae mas que eso."""
    with patch.object(pendiente_service, "append_pendiente_row") as append:
        record = pendiente_service.create_pendiente(PendienteInput(nombre_vino="Luca"))

    assert record.fecha_probado is None
    persisted = append.call_args.args[0]
    assert persisted["nombre_vino"] == "Luca"
    assert persisted["fecha_probado"] == ""
    assert persisted["vino_id"] == ""
    datetime.fromisoformat(persisted["fecha_alta"])


def test_sin_nombre_no_se_acepta():
    with pytest.raises(ValidationError):
        PendienteInput(nombre_vino="   ")


def test_probado_sin_fecha_es_hoy():
    with patch.object(pendiente_service, "append_pendiente_row"):
        record = pendiente_service.create_pendiente(
            PendienteInput(nombre_vino="Luca", puntuacion=4.5)
        )

    assert datetime.fromisoformat(record.fecha_probado).date() == datetime.now().date()


def test_una_fecha_sin_puntuacion_no_dice_nada():
    with patch.object(pendiente_service, "append_pendiente_row") as append:
        pendiente_service.create_pendiente(
            PendienteInput(nombre_vino="Luca", fecha_probado="2026-10-01")
        )

    assert append.call_args.args[0]["fecha_probado"] == ""


def test_la_puntuacion_va_de_medio_punto():
    with pytest.raises(ValidationError):
        PendienteInput(nombre_vino="Luca", puntuacion=4.2)


def test_editar_la_nota_no_cambia_el_dia_en_que_se_probo():
    values = como_values(
        pendiente_row(puntuacion="4", fecha_probado="2026-10-01T21:00:00")
    )
    with (
        patch.object(pendiente_service, "get_pendientes_values", return_value=values),
        patch.object(pendiente_service, "update_pendiente_row") as update,
    ):
        record = pendiente_service.update_pendiente(
            "pend-uuid",
            PendienteInput(nombre_vino="Gran Enemigo", puntuacion=5, notas="Enorme"),
        )

    cambios = update.call_args.args[1]
    assert cambios["fecha_probado"] == "2026-10-01T21:00:00"
    assert record.puntuacion == 5
    # La planilla ya leida se le pasa a la escritura: sin releerla.
    assert update.call_args.args[2] is values


def test_la_lista_saltea_filas_rotas_y_firma_solo_los_pendientes():
    filas = [
        pendiente_row(foto_url="pendientes/pend-uuid.jpg"),
        pendiente_row(id="roto", nombre_vino=""),
        pendiente_row(id="comprado", vino_id="vino-uuid", foto_url="pendientes/c.jpg"),
    ]
    with (
        patch.object(pendiente_service, "get_pendientes_rows", return_value=filas),
        patch.object(storage_service, "is_configured", return_value=True),
        patch.object(
            storage_service, "build_signed_url", return_value="https://firmada"
        ) as firmar,
    ):
        lista = pendiente_service.list_pendientes()

    assert [p.id for p in lista] == ["pend-uuid", "comprado"]
    assert lista[0].foto_url == "https://firmada"
    assert lista[1].foto_url == "pendientes/c.jpg"
    firmar.assert_called_once()


def comprar(pendiente, inventario=INVENTARIO, codigo="ELE-CAB-2019-0001"):
    values = como_values(pendiente)
    with (
        patch.object(pendiente_service, "get_pendientes_values", return_value=values),
        patch.object(
            pendiente_service, "get_inventory_values", return_value=inventario
        ) as leer_inventario,
        patch.object(pendiente_service, "update_pendiente_row") as update,
        patch.object(pendiente_service, "append_cata_record") as append_cata,
        patch.object(pendiente_service, "update_inventory_photo") as update_photo,
        patch.object(storage_service, "is_configured", return_value=True),
        patch.object(
            storage_service, "copy_to_label", return_value="etiquetas/ELE.jpg"
        ) as copiar,
    ):
        record = pendiente_service.marcar_comprado("pend-uuid", codigo)
    return record, {
        "leer_inventario": leer_inventario,
        "update": update,
        "append_cata": append_cata,
        "update_photo": update_photo,
        "copiar": copiar,
    }


def test_al_comprarlo_la_cata_de_la_cena_pasa_al_historico_con_su_fecha():
    record, mocks = comprar(
        pendiente_row(
            puntuacion="4,5",
            notas="Fruta negra",
            maridaje="Ojo de bife",
            fecha_probado="2026-10-01T21:00:00",
        )
    )

    assert record.vino_id == "vino-uuid"
    mocks["update"].assert_called_once()
    assert mocks["update"].call_args.args[1] == {"vino_id": "vino-uuid"}
    cata = mocks["append_cata"].call_args.args[0]
    # El uuid del vino, no su codigo: el codigo se reusa.
    assert cata["vino_id"] == "vino-uuid"
    assert cata["codigo_vino"] == "ELE-CAB-2019-0001"
    assert cata["fecha_consumo"] == "2026-10-01T21:00:00"
    assert cata["puntuacion"] == 4.5
    assert cata["notas_cata"] == "Fruta negra"
    assert cata["maridaje"] == "Ojo de bife"
    mocks["leer_inventario"].assert_called_once()


def test_lo_recomendado_sin_probar_no_inventa_una_cata():
    _, mocks = comprar(pendiente_row(notas="Juan dice que es frutado"))

    mocks["append_cata"].assert_not_called()


def test_la_foto_pasa_al_vino_que_no_tenia():
    _, mocks = comprar(pendiente_row(foto_url="pendientes/pend-uuid.jpg"))

    mocks["copiar"].assert_called_once_with("pendientes/pend-uuid.jpg", "ELE-CAB-2019-0001")
    mocks["update_photo"].assert_called_once_with(
        "ELE-CAB-2019-0001", "etiquetas/ELE.jpg", INVENTARIO
    )


def test_no_pisa_la_foto_de_un_vino_que_ya_tenia():
    _, mocks = comprar(
        pendiente_row(foto_url="pendientes/pend-uuid.jpg"), codigo="TRA-MAL-2020-0001"
    )

    mocks["copiar"].assert_not_called()


def test_si_falla_la_foto_la_compra_queda_igual():
    values = como_values(pendiente_row(puntuacion="4", foto_url="pendientes/p.jpg"))
    with (
        patch.object(pendiente_service, "get_pendientes_values", return_value=values),
        patch.object(pendiente_service, "get_inventory_values", return_value=INVENTARIO),
        patch.object(pendiente_service, "update_pendiente_row") as update,
        patch.object(pendiente_service, "append_cata_record") as append_cata,
        patch.object(storage_service, "is_configured", return_value=True),
        patch.object(storage_service, "copy_to_label", side_effect=RuntimeError("GCS")),
    ):
        record = pendiente_service.marcar_comprado("pend-uuid", "ELE-CAB-2019-0001")

    assert record.vino_id == "vino-uuid"
    update.assert_called_once()
    append_cata.assert_called_once()


def test_comprarlo_dos_veces_no_duplica_la_cata():
    """Reintentar despues de un error no puede volver a escribir la cata."""
    record, mocks = comprar(pendiente_row(puntuacion="4", vino_id="vino-uuid"))

    assert record.vino_id == "vino-uuid"
    mocks["append_cata"].assert_not_called()
    mocks["update"].assert_not_called()
    mocks["leer_inventario"].assert_not_called()


def test_comprar_contra_un_vino_que_no_existe():
    with pytest.raises(ValueError):
        comprar(pendiente_row(), codigo="NO-EXISTE")


def test_borrar_se_lleva_la_foto():
    values = como_values(pendiente_row(foto_url="pendientes/pend-uuid.jpg"))
    with (
        patch.object(pendiente_service, "get_pendientes_values", return_value=values),
        patch.object(pendiente_service, "delete_pendiente_row") as delete_row,
        patch.object(storage_service, "is_configured", return_value=True),
        patch.object(storage_service, "delete_label_photo") as delete_photo,
    ):
        pendiente_service.delete_pendiente("pend-uuid")

    delete_row.assert_called_once_with("pend-uuid", values)
    delete_photo.assert_called_once_with("pendientes/pend-uuid.jpg")


def test_la_foto_de_un_pendiente_va_a_su_carpeta():
    assert (
        storage_service.build_object_name(
            "pend-uuid", "image/png", storage_service.CARPETA_PENDIENTES
        )
        == "pendientes/pend-uuid.png"
    )


def test_la_copia_no_se_sale_de_etiquetas():
    with pytest.raises(ValueError):
        storage_service.copy_to_label("pendientes/p.jpg", "../../estado/rate-limit")


def test_la_copia_conserva_la_extension():
    bucket = MagicMock()
    with patch.object(storage_service, "get_bucket", return_value=bucket):
        destino = storage_service.copy_to_label("pendientes/p.webp", "ELE-CAB-2019-0001")

    assert destino == "etiquetas/ELE-CAB-2019-0001.webp"
    bucket.copy_blob.assert_called_once()


def test_post_sin_nombre_es_422():
    response = client.post("/api/pendientes", json={"bodega": "El Enemigo"})

    assert response.status_code == 422


def test_comprar_un_pendiente_que_no_existe_es_404():
    with patch(
        "app.routes.pendientes.marcar_comprado", side_effect=ValueError("no existe")
    ):
        response = client.post(
            "/api/pendientes/nada/comprado", json={"codigo_vino": "ELE-CAB-2019-0001"}
        )

    assert response.status_code == 404
