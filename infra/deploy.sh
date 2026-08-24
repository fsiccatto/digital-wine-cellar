#!/usr/bin/env bash
# Deploy de Mi Cava Virtual a un proyecto GCP dedicado.
#
# Requiere: gcloud autenticado, y las variables de abajo completadas.
# Todo lo que crea entra en el free tier permanente; la cuenta de facturacion
# hace falta igual porque GCS y Cloud Run la exigen para habilitarse.
#
#   bash infra/deploy.sh
#
set -euo pipefail

# --- Completar antes de correr ------------------------------------------
PROJECT_ID="${PROJECT_ID:-}"          # ej: mi-cava-virtual-2026 (debe ser unico global)
BILLING_ACCOUNT="${BILLING_ACCOUNT:-017886-6FBE15-74AE46}"
REGION="${REGION:-us-central1}"
SHEET_NAME="${SHEET_NAME:-Mi_Cava_Virtual}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"  # si se omite, se lee de backend/.env
# ------------------------------------------------------------------------

REPO="digital-wine-cellar"
SERVICE="digital-wine-cellar-backend"
BUCKET="${PROJECT_ID}-wine-labels"
SA_NAME="wine-cellar"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo; echo "=== $* ==="; }

[[ -n "$PROJECT_ID" ]] || die "Falta PROJECT_ID. Editá el script o exportá la variable."

if [[ -z "$GEMINI_API_KEY" && -f "$ROOT/backend/.env" ]]; then
  GEMINI_API_KEY="$(grep -E '^GEMINI_API_KEY=' "$ROOT/backend/.env" | cut -d= -f2- | tr -d '\r')"
fi
[[ -n "$GEMINI_API_KEY" ]] || die "Falta GEMINI_API_KEY (ni en el entorno ni en backend/.env)."

step "1/9 Proyecto $PROJECT_ID"
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "ya existe, se reutiliza"
else
  gcloud projects create "$PROJECT_ID" --name="Digital Wine Cellar"
fi
gcloud config set project "$PROJECT_ID" >/dev/null

step "2/9 Vincular facturacion"
# Sin billing, GCS y Cloud Run devuelven 403 aunque el uso sea gratis.
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"

step "3/9 Habilitar APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  sheets.googleapis.com \
  drive.googleapis.com \
  generativelanguage.googleapis.com

step "4/9 Service Account de la app"
if gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  echo "ya existe, se reutiliza"
else
  gcloud iam service-accounts create "$SA_NAME" --display-name="Digital Wine Cellar"
fi

# La clave es la que firma las URLs de las fotos y lee el Sheet.
if [[ -f "$ROOT/backend/credentials.json" ]]; then
  echo "backend/credentials.json ya existe: NO se sobrescribe."
  echo "Si es del proyecto viejo, borralo y volvé a correr este paso."
else
  gcloud iam service-accounts keys create "$ROOT/backend/credentials.json" \
    --iam-account="$SA_EMAIL"
  echo "Clave escrita en backend/credentials.json (esta en .gitignore)."
fi

step "5/9 Secretos"
create_secret() {
  local name="$1" value="$2"
  gcloud secrets describe "$name" >/dev/null 2>&1 \
    || gcloud secrets create "$name" --replication-policy=automatic
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
}
create_secret "gemini-api-key" "$GEMINI_API_KEY"
gcloud secrets describe sheets-credentials >/dev/null 2>&1 \
  || gcloud secrets create sheets-credentials --replication-policy=automatic
gcloud secrets versions add sheets-credentials \
  --data-file="$ROOT/backend/credentials.json"

step "6/9 Bucket privado de fotos"
if gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  echo "ya existe, se reutiliza"
else
  gcloud storage buckets create "gs://$BUCKET" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" >/dev/null

step "7/9 Artifact Registry + build de la imagen"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$REPO" \
       --repository-format=docker --location="$REGION"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest"
# Build en la nube: no hace falta Docker local.
gcloud builds submit "$ROOT/backend" --tag "$IMAGE"

step "8/9 Desplegar Cloud Run"
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=2 \
  --cpu=1 --memory=512Mi \
  --port=8080 \
  --set-env-vars="GOOGLE_SHEET_NAME=${SHEET_NAME},GCS_BUCKET_NAME=${BUCKET},GOOGLE_SHEETS_CREDENTIALS_FILE=/secrets/credentials.json" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,/secrets/credentials.json=sheets-credentials:latest"

URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"

step "9/9 Listo"
cat <<EOF

  Backend: $URL

  Falta un paso MANUAL para que lea la planilla:
  compartir el Sheet "$SHEET_NAME" con esta cuenta, como Editor:

      $SA_EMAIL

  Despues, verificar:
      curl $URL/health
      curl $URL/api/wines

  Para el frontend:
      cd frontend && VITE_API_BASE="$URL" npm run build

EOF
