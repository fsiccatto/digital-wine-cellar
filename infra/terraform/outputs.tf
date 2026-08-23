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
