# Mi Cava Virtual

Backend para inventario personal de vinos con:

- escaneo de etiqueta con Gemini;
- persistencia en Google Sheets;
- control de stock y registro de catas.

## Stack actual

- Python 3.11
- FastAPI
- Google Gemini (`gemini-3.6-flash`)
- Google Sheets API (Service Account)

## Requisitos

- Python 3.11
- Archivo `backend/.env`
- Archivo `backend/credentials.json`

Variables de entorno esperadas:

```env
GEMINI_API_KEY=tu_api_key
GOOGLE_SHEETS_CREDENTIALS_FILE=credentials.json
GOOGLE_SHEET_NAME=Mi_Cava_Virtual
MAX_IMAGE_SIZE_BYTES=10485760
```

## Comandos utiles

```bash
# tests
.venv/Scripts/python -m pytest backend/tests -q

# lint
.venv/Scripts/python -m ruff check backend/app backend/tests

# run API
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Seguridad y robustez ya implementadas

- upload de imagen con limite configurable (`MAX_IMAGE_SIZE_BYTES`);
- validacion real de imagen con Pillow (no solo MIME);
- fechas de ingreso/consumo generadas solo por el sistema;
- validaciones de negocio con Pydantic:
	- anada entre 1900 y anio actual;
	- cantidad >= 0;
	- puntuacion entre 1 y 5;
	- campos obligatorios no vacios.

## Codigo interno de vino

Cada vino tiene dos identificadores:

- `id`: UUID tecnico interno.
- `codigo_vino`: codigo legible para operar consumo.

Formato:

```text
<BOD>-<VAR>-<ANADA>-<SECUENCIA>
```

Ejemplo:

```text
TRA-MAL-2020-0001
```

Donde:

- `BOD`: 3 caracteres de bodega.
- `VAR`: 3 caracteres de varietal.
- `ANADA`: anada del vino.
- `SECUENCIA`: contador incremental para la combinacion BOD-VAR-ANADA.

El endpoint de consumo usa `codigo_vino`:

```http
POST /api/wines/{codigo_vino}/consume
```

## Terraform (Cloud Run)

Se agrega base Terraform en `infra/terraform` para desplegar el backend en Cloud Run.

Flujo esperado:

1. construir y publicar imagen del backend;
2. configurar variables de Terraform;
3. ejecutar `terraform init/plan/apply`.

> Nota: Terraform provisiona infraestructura. La imagen del contenedor se debe publicar previamente.
