variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "digital-wine-cellar-backend"
}

variable "container_image" {
  description = "Container image URL (Artifact Registry, GCR or Docker Hub)"
  type        = string
}

variable "allow_unauthenticated" {
  description = "Allow public access to the Cloud Run service"
  type        = bool
  default     = true
}

variable "container_port" {
  description = "Container listening port"
  type        = number
  default     = 8080
}

variable "sheets_credentials_secret_id" {
  description = "Secret Manager secret holding the Sheets Service Account JSON"
  type        = string
  default     = "sheets-credentials"
}

variable "gemini_api_key_secret_id" {
  description = "Secret Manager secret holding the Gemini API key"
  type        = string
  default     = "gemini-api-key"
}

variable "secrets_mount_path" {
  description = "Directory where secret files are mounted inside the container"
  type        = string
  default     = "/secrets"
}

variable "max_instances" {
  description = "Upper bound on Cloud Run instances, caps worst-case cost"
  type        = number
  default     = 2
}

variable "environment_variables" {
  description = "Plain environment variables for Cloud Run"
  type        = map(string)
  default     = {}
}
