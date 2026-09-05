provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "required" {
  for_each = toset([
    "run.googleapis.com",
    "iamcredentials.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "cloudbuild.googleapis.com",
    # La app lee la planilla y firma URLs de fotos con la misma Service
    # Account, y manda las etiquetas a Gemini.
    "sheets.googleapis.com",
    "drive.googleapis.com",
    "generativelanguage.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Donde el workflow publica la imagen del backend.
resource "google_artifact_registry_repository" "backend" {
  location      = var.region
  repository_id = var.artifact_repository
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

# Fotos de etiqueta. Privado: se sirven con URLs firmadas, no por link publico.
resource "google_storage_bucket" "labels" {
  name     = var.labels_bucket_name
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Standard en una sola region y sin versionado: lo que entra en los 5 GB
  # gratis del free tier.
  storage_class = "STANDARD"

  depends_on = [google_project_service.required]
}

# La SA del JSON de credenciales es la que firma las URLs y sube los objetos.
resource "google_storage_bucket_iam_member" "labels_writer" {
  bucket = google_storage_bucket.labels.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.sheets_service_account_email}"
}

# Identidad propia del servicio. La SA default de Compute trae mas permisos
# de los que este backend necesita.
resource "google_service_account" "backend" {
  # El id va aparte de service_name: es la identidad con la que se comparte
  # la planilla, asi que cambiarlo obliga a recompartirla y a regenerar
  # credentials.json. Un rename silencioso aca rompe el acceso al Sheet.
  account_id   = var.backend_service_account_id
  display_name = "Digital Wine Cellar backend"

  depends_on = [google_project_service.required]
}

# Solo los contenedores de los secretos. El valor real se carga por fuera de
# Terraform para no dejarlo en el state:
#   gcloud secrets versions add sheets-credentials --data-file=backend/credentials.json
#   printf '%s' "TU_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
resource "google_secret_manager_secret" "sheets_credentials" {
  secret_id = var.sheets_credentials_secret_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = var.gemini_api_key_secret_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

# Clave compartida para entrar a la app. El backend aborta el arranque en
# Cloud Run si esta vacia, asi que el secreto tiene que existir siempre.
resource "google_secret_manager_secret" "app_token" {
  secret_id = var.app_token_secret_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "app_token_accessor" {
  secret_id = google_secret_manager_secret.app_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "sheets_credentials_accessor" {
  secret_id = google_secret_manager_secret.sheets_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "gemini_api_key_accessor" {
  secret_id = google_secret_manager_secret.gemini_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_cloud_run_v2_service" "backend" {
  name     = var.service_name
  location = var.region

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.backend.email

    # min = 0 es lo que mantiene el costo en cero: sin trafico no hay
    # instancias facturables. max = 1 ademas mantiene exactos los limites
    # de uso, que se cuentan en memoria del proceso (ver app/rate_limit.py).
    scaling {
      min_instance_count = 0
      max_instance_count = var.max_instances
    }

    containers {
      image = var.container_image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # Sin CPU asignada mientras no atiende requests: el trabajo real es
        # esperar a Sheets y Gemini.
        cpu_idle = true
      }

      dynamic "env" {
        for_each = var.environment_variables
        content {
          name  = env.key
          value = env.value
        }
      }

      # Apunta al JSON de la Service Account montado desde Secret Manager.
      env {
        name  = "GOOGLE_SHEETS_CREDENTIALS_FILE"
        value = "${var.secrets_mount_path}/credentials.json"
      }

      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.labels.name
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "APP_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app_token.secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "sheets-credentials"
        mount_path = var.secrets_mount_path
      }
    }

    volumes {
      name = "sheets-credentials"

      secret {
        secret = google_secret_manager_secret.sheets_credentials.secret_id

        items {
          version = "latest"
          path    = "credentials.json"
          mode    = 292 # 0444, solo lectura
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.sheets_credentials_accessor,
    google_secret_manager_secret_iam_member.gemini_api_key_accessor,
    google_secret_manager_secret_iam_member.app_token_accessor,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Deploy desde GitHub Actions -----------------------------------------
# Federacion en vez de una clave JSON guardada en el repo: GitHub cambia su
# propio token OIDC por uno de GCP que dura minutos. No hay credencial de
# larga duracion que rotar ni que se pueda filtrar desde los secrets.

resource "google_service_account" "deployer" {
  # Maximo 30 caracteres, de ahi que no cuelgue de service_name.
  account_id   = var.deployer_service_account_id
  display_name = "GitHub Actions deployer"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = var.github_pool_id
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = var.github_provider_id
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # Sin esto, el token de CUALQUIER repo de GitHub sirve para entrar.
  attribute_condition = "assertion.repository == ${jsonencode(var.github_repository)}"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Solo los workflows de este repo pueden actuar como el deployer.
resource "google_service_account_iam_member" "deployer_workload_user" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# Lo minimo para construir la imagen y publicar una revision.
resource "google_project_iam_member" "deployer_roles" {
  for_each = toset([
    "roles/run.developer",
    "roles/artifactregistry.writer",
    "roles/cloudbuild.builds.editor",
    "roles/storage.admin",
    "roles/logging.viewer",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Cloud Build construye la imagen con la SA de compute por defecto, asi que el
# deployer necesita poder actuar como ella. Sin esto `gcloud builds submit`
# corta con PERMISSION_DENIED antes de empezar a construir.
data "google_project" "current" {
  project_id = var.project_id
}

resource "google_service_account_iam_member" "deployer_actas_compute" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${data.google_project.current.number}-compute@developer.gserviceaccount.com"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# El deployer despliega el servicio, que corre como la SA del backend: hace
# falta permiso explicito para asignarla.
resource "google_service_account_iam_member" "deployer_actas_backend" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}
