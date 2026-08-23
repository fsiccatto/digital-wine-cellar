from unittest.mock import patch

import pytest

from app.services import storage_service, wine_service


def inventory_row(foto_url=""):
    return {
        "id": "internal-uuid",
        "codigo_vino": "TRA-MAL-2020-0001",
        "fecha_ingreso": "2026-03-12T10:00:00",
        "bodega": "Trapiche",
        "nombre_vino": "Fond de Cave",
        "varietal": "Malbec",
        "anada": "2020",
        "region": "Mendoza",
        "alcohol": "14%",
        "cantidad": "2",
        "ubicacion": "A2",
        "precio_estimado": "",
        "foto_url": foto_url,
    }


def test_object_name_uses_code_and_mime_extension():
    assert (
        storage_service.build_object_name("TRA-MAL-2020-0001", "image/png")
        == "etiquetas/TRA-MAL-2020-0001.png"
    )
    # Un mime desconocido no debe romper la subida.
    assert (
        storage_service.build_object_name("TRA-MAL-2020-0001", "image/tiff")
        == "etiquetas/TRA-MAL-2020-0001.jpg"
    )


def test_attach_photo_stores_object_name_not_url():
    with (
        patch.object(storage_service, "is_configured", return_value=True),
        patch.object(
            wine_service, "get_inventory_rows", return_value=[inventory_row()]
        ),
        patch.object(
            storage_service,
            "upload_label_photo",
            return_value="etiquetas/TRA-MAL-2020-0001.jpg",
        ) as upload,
        patch.object(wine_service, "update_inventory_photo") as update_photo,
        patch.object(
            wine_service,
            "get_wine",
            return_value=None,
        ),
    ):
        wine_service.attach_label_photo(
            "TRA-MAL-2020-0001", b"fake-bytes", "image/jpeg"
        )

    upload.assert_called_once()
    # En el Sheet queda el nombre del objeto, no una URL que caduca.
    update_photo.assert_called_once_with(
        "TRA-MAL-2020-0001", "etiquetas/TRA-MAL-2020-0001.jpg"
    )


def test_attach_photo_rejects_unknown_code_before_uploading():
    with (
        patch.object(storage_service, "is_configured", return_value=True),
        patch.object(wine_service, "get_inventory_rows", return_value=[]),
        patch.object(storage_service, "upload_label_photo") as upload,
    ):
        with pytest.raises(ValueError):
            wine_service.attach_label_photo("NO-EXISTE-0000", b"x", "image/jpeg")

    upload.assert_not_called()


def test_attach_photo_requires_bucket_configured():
    with patch.object(storage_service, "is_configured", return_value=False):
        with pytest.raises(storage_service.StorageNotConfigured):
            wine_service.attach_label_photo("TRA-MAL-2020-0001", b"x", "image/jpeg")


def test_listing_signs_stored_object_names():
    with (
        patch.object(storage_service, "is_configured", return_value=True),
        patch.object(
            storage_service,
            "build_signed_url",
            return_value="https://signed.example/etiqueta.jpg?sig=abc",
        ),
        patch.object(
            wine_service,
            "get_inventory_rows",
            return_value=[inventory_row("etiquetas/TRA-MAL-2020-0001.jpg")],
        ),
    ):
        wines = wine_service.list_wines()

    assert wines[0].foto_url == "https://signed.example/etiqueta.jpg?sig=abc"


def test_listing_without_bucket_leaves_photo_untouched():
    with (
        patch.object(storage_service, "is_configured", return_value=False),
        patch.object(
            wine_service,
            "get_inventory_rows",
            return_value=[inventory_row("etiquetas/TRA-MAL-2020-0001.jpg")],
        ),
    ):
        wines = wine_service.list_wines()

    assert wines[0].foto_url == "etiquetas/TRA-MAL-2020-0001.jpg"


def test_create_wine_ignores_client_supplied_photo():
    from pydantic import ValidationError

    from app.schemas.wine_schema import WineCreateInput

    # foto_url no es aceptable en la creación: la escribe el endpoint de foto.
    with pytest.raises(ValidationError):
        WineCreateInput(
            bodega="Trapiche",
            nombre_vino="Fond de Cave",
            varietal="Malbec",
            anada=2020,
            region="Mendoza",
            alcohol="14%",
            foto_url="https://atacante.example/x.jpg",
        )
