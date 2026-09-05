# Infraestructura (Cloud Run)

Todo lo que la app necesita en GCP se define acá, como estado que se puede
planificar y revisar antes de aplicarlo.

Después del primer `apply`, los deploys salen solos por
`.github/workflows/deploy-backend.yml` en cada push a `main` que toque
`backend/`.

## Qué crea

- APIs: Run, Artifact Registry, Secret Manager, Storage, Cloud Build, Sheets,
  Drive, Generative Language, IAM Credentials
- El repositorio de Artifact Registry donde CI publica la imagen
- El bucket privado de fotos de etiqueta, y el permiso de la app sobre él
- La Service Account del backend
- Los secretos `app-token`, `gemini-api-key` y `sheets-credentials` (los
  contenedores; los valores se cargan a mano, ver abajo)
- El servicio de Cloud Run, con `max_instances = 1`
- La federación (Workload Identity) que deja desplegar desde GitHub Actions
  sin guardar ninguna clave en el repo

## Lo que NO crea, y hay que hacer una vez

Son los pasos que necesitan una decisión o una credencial, y que por eso no
tiene sentido automatizar:

1. **El proyecto y la facturación.** Sin una cuenta vinculada, Storage y Run
   devuelven 403 aunque el uso entre en el free tier:

   ```bash
   gcloud projects create TU_PROYECTO --name="Digital Wine Cellar"
   gcloud billing projects link TU_PROYECTO --billing-account="$(gcloud billing accounts list --format='value(name)' --limit=1)"
   ```

2. **La clave de la Service Account.** Es lo que firma las URLs de las fotos y
   lee la planilla. Se genera después del primer `apply`:

   ```bash
   gcloud iam service-accounts keys create backend/credentials.json \
     --iam-account="$(terraform output -raw backend_service_account)"
   ```

3. **Los valores de los secretos.** Terraform crea los contenedores vacíos;
   los valores no entran al estado:

   ```bash
   printf '%s' "TU_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
   openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add app-token --data-file=-
   gcloud secrets versions add sheets-credentials --data-file=backend/credentials.json
   ```

   Sin `app-token` el backend **no arranca** en Cloud Run: prefiere fallar
   antes que publicar la cava abierta.

4. **Compartir la planilla.** Como Editor, con la cuenta que devuelve
   `terraform output backend_service_account`. Es el paso que más se olvida:
   sin esto la API levanta pero no ve ningún vino.

5. **Las variables del repo en GitHub** (Settings > Secrets and variables >
   Actions > Variables), para que el workflow pueda desplegar:

   | Variable | De dónde sale |
   |---|---|
   | `GCP_PROJECT_ID` | tu project id |
   | `GCP_WIF_PROVIDER` | `terraform output -raw workload_identity_provider` |
   | `GCP_DEPLOY_SA` | `terraform output -raw deployer_service_account` |
   | `GCP_ARTIFACT_REPO` | `terraform output -raw artifact_repository_url` (solo el último segmento) |

## Uso

El state vive en un bucket, no en la máquina, así que la primera vez hay dos
archivos que copiar:

```bash
cp terraform.tfvars.example terraform.tfvars   # editar con tu proyecto
cp backend.hcl.example backend.hcl             # el bucket del state

terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Ninguno de los dos se versiona: llevan el project id y este repo es público.
Por eso el bloque `backend "gcs" {}` de `versions.tf` va vacío y el bucket se
pasa por `-backend-config`.

Huevo y gallina: el bucket del state tiene que existir antes del primer `init`.
Se crea una sola vez y después Terraform lo adopta:

```bash
gcloud storage buckets create gs://TU-PROYECTO-tfstate   --location=us-central1 --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://TU-PROYECTO-tfstate --versioning
terraform import google_storage_bucket.tfstate TU-PROYECTO/TU-PROYECTO-tfstate
```

## Notas

- El state está en GCS con versionado. Si se pierde, Terraform deja de saber
  qué recursos existen y hay que reimportarlos uno por uno; el versionado
  también cubre el caso de un `apply` que lo deje mal.
- `max_instances = 1` no es por costo: los límites de uso se cuentan en memoria
  del proceso, así que con dos instancias el tope real se duplicaría. Ver
  `backend/app/rate_limit.py`.
- `container_image` es el punto de partida; después de eso la imagen la maneja
  el workflow de deploy, así que `terraform plan` va a querer volver a la del
  tfvars. Actualizala o usá `-refresh-only` para ignorar esa diferencia.
- Para dejar la API privada de verdad: `allow_unauthenticated = false`.
