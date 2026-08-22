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
  default     = 8000
}

variable "environment_variables" {
  description = "Plain environment variables for Cloud Run"
  type        = map(string)
  default     = {}
}
