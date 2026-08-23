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

## Fotos de etiqueta (Google Cloud Storage)

La foto se sube **despues** de crear el vino, en su propio endpoint. Asi el POST
de creacion sigue siendo JSON puro y no quedan fotos huerfanas de escaneos que
el usuario abandona.

```http
POST /api/wines                      -> crea el vino, devuelve codigo_vino
POST /api/wines/{codigo_vino}/foto   -> multipart, sube la etiqueta
GET  /api/wines/{codigo_vino}        -> un vino con su foto_url ya firmada
```

El bucket es **privado** (`public-access-prevention` activo). En la columna
`foto_url` del Sheet se guarda el nombre del objeto
(`etiquetas/TRA-MAL-2020-0001.jpg`), no una URL: las URLs de lectura se firman
on demand al listar o pedir un vino, y caducan segun
`GCS_SIGNED_URL_TTL_SECONDS` (1 h por defecto). Quien firma es la Service
Account de `credentials.json`, la misma que lee el Sheet.

`foto_url` no se acepta en `POST /api/wines`: solo lo escribe el endpoint de
foto, para que un cliente no pueda apuntar el campo a una URL arbitraria.

Sin `GCS_BUCKET_NAME` la app funciona igual, sin fotos: el endpoint de foto
responde 503 y el listado devuelve `foto_url` tal como este en el Sheet.

> Pendiente de verificar de punta a punta: crear el bucket requiere una cuenta
> de facturacion vinculada al proyecto (el free tier de 5 GB existe, pero GCS
> la exige igual). Ver "Proyecto GCP dedicado" abajo.

## Proyecto GCP dedicado

El backend no tiene el project ID en el codigo: sale de variables de entorno y
de `terraform.tfvars`. Cambiar de proyecto no toca codigo.

El project ID de GCP es **inmutable**: se puede cambiar el display name, no el
ID. Para tener un proyecto dedicado hay que crear uno nuevo.

```bash
PROJECT=digital-wine-cellar-prod   # elegir un ID libre y definitivo
gcloud projects create $PROJECT --name="Digital Wine Cellar"
gcloud billing projects link $PROJECT --billing-account=TU-BILLING-ID
gcloud config set project $PROJECT

gcloud services enable sheets.googleapis.com storage.googleapis.com \
  run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com

# Service Account propia del proyecto nuevo
gcloud iam service-accounts create wine-cellar \
  --display-name="Digital Wine Cellar"
gcloud iam service-accounts keys create backend/credentials.json \
  --iam-account=wine-cellar@$PROJECT.iam.gserviceaccount.com
```

Despues de eso quedan dos pasos manuales, y el backend no lee el Sheet hasta
que se hagan:

1. **Compartir la planilla** `Mi_Cava_Virtual` con el `client_email` del
   `credentials.json` nuevo (ver la nota de Terraform sobre las dos
   identidades).
2. **Regenerar `GEMINI_API_KEY`** si la actual salio de AI Studio atada al
   proyecto viejo.

## Frontend

Vite + React 19 + TypeScript + Tailwind 4, en `frontend/`. Tres pantallas
mobile: cava (listado por estantes), escaneo (foto -> Gemini -> formulario) y
ficha del vino (stock, descorchar, cata).

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/ estatico
```

En desarrollo el proxy de Vite manda `/api` y `/health` al backend en
`localhost:8080`, asi que no hace falta CORS. Para apuntar a otro backend
(Cloud Run), definir `VITE_API_BASE` al buildear.

Los colores de bodega viven como tokens `@theme` en `src/index.css`, asi que se
usan como utilidades de Tailwind (`text-oro`, `bg-madera-900`). Los tipos de
`src/lib/types.ts` espejan los esquemas Pydantic del backend.

Dos detalles que ya mordieron una vez:

- El reset de `color: inherit` para botones va dentro de `@layer base`. Suelto en
  la hoja le gana en especificidad a las utilidades de Tailwind y todos los
  botones salen color crema, sin importar el `text-*` que tengan.
- Cormorant Garamond usa numeros oldstyle: el `1` sale como una `I`. Las cifras
  (stock, anada, precio, codigo) llevan la clase `.cifra`, que fuerza
  `lining-nums`.

El Sheet se edita a mano, asi que la UI no confia en sus valores: una fecha que
no parsea o una anada menor a 1900 se omiten en vez de mostrarse crudas, y
`foto_url` solo se renderiza como imagen si es una URL absoluta.

El build es estatico: se hostea gratis en GitHub Pages, Netlify o Cloudflare
Pages, sin necesidad de cuenta de facturacion.

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
