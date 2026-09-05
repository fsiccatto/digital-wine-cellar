output "cloud_run_service_name" {
  value       = google_cloud_run_v2_service.backend.name
  description = "Cloud Run service name"
}

output "cloud_run_service_uri" {
  value       = google_cloud_run_v2_service.backend.uri
  description = "Cloud Run service URL"
}

output "service_account_email" {
  value       = google_service_account.backend.email
  description = "Runtime identity. Not the account that reads the sheet: share the spreadsheet with the client_email inside credentials.json."
}

output "artifact_repository_url" {
  description = "Base URL for the backend image; the deploy workflow pushes here"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}"
}

output "backend_service_account" {
  description = "Share the Sheet with this account as Editor"
  value       = google_service_account.backend.email
}

# Los dos valores que hay que cargar en GitHub > Settings > Variables.
output "workload_identity_provider" {
  description = "Value for the GCP_WIF_PROVIDER repository variable"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  description = "Value for the GCP_DEPLOY_SA repository variable"
  value       = google_service_account.deployer.email
}
