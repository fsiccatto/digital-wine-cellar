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

variable "labels_bucket_name" {
  description = "Globally unique GCS bucket for label photos"
  type        = string
}

variable "sheets_service_account_email" {
  description = "client_email from credentials.json: signs photo URLs and reads the sheet"
  type        = string
}

variable "max_instances" {
  description = "Upper bound on Cloud Run instances; keep at 1 so the in-memory rate limits stay exact"
  type        = number
  default     = 1
}

variable "artifact_repository" {
  description = "Artifact Registry repo where CI publishes the backend image"
  type        = string
  default     = "digital-wine-cellar"
}

variable "app_token_secret_id" {
  description = "Secret Manager id for the shared app token"
  type        = string
  default     = "app-token"
}

variable "environment_variables" {
  description = "Plain environment variables for Cloud Run"
  type        = map(string)
  default     = {}
}

variable "github_repository" {
  description = "owner/repo allowed to deploy through Workload Identity Federation"
  type        = string
}

variable "github_pool_id" {
  description = "Workload Identity Pool id"
  type        = string
  default     = "github-actions"
}

variable "github_provider_id" {
  description = "Workload Identity Pool provider id"
  type        = string
  default     = "github-oidc"
}
