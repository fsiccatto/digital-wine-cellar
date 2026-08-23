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

## Docker

La imagen corre uvicorn en `$PORT` (default `8080`, el que espera Cloud Run).
`.dockerignore` excluye `.env`, `credentials.json`, `tests/` y `scripts/`: las
credenciales nunca entran en la imagen, se inyectan en runtime.

```powershell
cd backend
docker build -t digital-wine-cellar:test .

# credentials.json se monta como volumen, igual que hace Secret Manager en Cloud Run
$key = (Get-Content .env | Select-String -Pattern "^GEMINI_API_KEY=").ToString() -replace '^GEMINI_API_KEY=',''
docker run -d --name dwc-test -p 8080:8080 `
  -v "${PWD}\credentials.json:/secrets/credentials.json:ro" `
  -e GOOGLE_SHEETS_CREDENTIALS_FILE=/secrets/credentials.json `
  -e GEMINI_API_KEY="$key" `
  -e GOOGLE_SHEET_NAME=Mi_Cava_Virtual `
  digital-wine-cellar:test

curl http://localhost:8080/health
docker logs dwc-test
docker rm -f dwc-test
```

## Terraform (Cloud Run)

`infra/terraform` despliega el backend en Cloud Run. Lo que provisiona:

- servicio Cloud Run con `min_instance_count = 0` y `cpu_idle`, para que sin
  trafico no haya instancias facturables;
- Service Account propia para el runtime (la default de Compute tiene mas
  permisos de los necesarios);
- dos secretos en Secret Manager: `sheets-credentials` (montado como archivo en
  `/secrets/credentials.json`) y `gemini-api-key` (inyectado como env var), con
  el IAM `secretAccessor` correspondiente.

`GEMINI_API_KEY` y `GOOGLE_SHEETS_CREDENTIALS_FILE` los inyecta Terraform desde
Secret Manager: no van en `environment_variables` del tfvars.

Flujo de deploy:

```bash
PROJECT=$(gcloud config get-value project)
REGION=us-central1

gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories create digital-wine-cellar \
  --repository-format=docker --location=$REGION

# build en la nube: no necesita Docker local
gcloud builds submit backend \
  --tag $REGION-docker.pkg.dev/$PROJECT/digital-wine-cellar/backend:latest

# los valores de los secretos se cargan fuera de Terraform para que no queden en el state
gcloud secrets create sheets-credentials --replication-policy=automatic
gcloud secrets versions add sheets-credentials --data-file=backend/credentials.json
gcloud secrets create gemini-api-key --replication-policy=automatic
printf '%s' "$GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-

cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # completar project_id y container_image
terraform init && terraform plan && terraform apply
```

> El Sheet lo lee el `client_email` que esta dentro de `credentials.json`, no la
> Service Account que crea Terraform. La planilla se comparte con ese primero.
>
> Terraform no esta instalado en el entorno de desarrollo actual
> (`winget install Hashicorp.Terraform`). El deploy queda pendiente hasta que el
> desarrollo del backend este cerrado.
