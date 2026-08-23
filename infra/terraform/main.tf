provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "required" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com"
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Identidad propia del servicio. La SA default de Compute trae mas permisos
# de los que este backend necesita.
resource "google_service_account" "backend" {
  account_id   = "${var.service_name}-sa"
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

  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.backend.email

    # min = 0 es lo que mantiene el costo en cero: sin trafico no hay
    # instancias facturables. max acota un pico inesperado.
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
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
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
