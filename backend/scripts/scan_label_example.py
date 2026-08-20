import argparse

from app.services.gemini_service import extract_wine_data_from_image_bytes


def main():
    parser = argparse.ArgumentParser(description="Prueba la extracción de una etiqueta con Gemini.")
    parser.add_argument("--image", required=True, help="Ruta de la imagen a escanear.")
    parser.add_argument("--mime", default="image/jpeg", help="Mime type de la imagen.")
    args = parser.parse_args()

    with open(args.image, "rb") as image_file:
        image_bytes = image_file.read()

    data = extract_wine_data_from_image_bytes(image_bytes, mime_type=args.mime)
    print(data)


if __name__ == "__main__":
    main()
