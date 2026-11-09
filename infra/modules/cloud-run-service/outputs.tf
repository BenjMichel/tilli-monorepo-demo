output "name" {
  description = "Name of the Cloud Run service."
  value       = google_cloud_run_v2_service.this.name
}

output "uri" {
  description = "HTTPS URL of the service."
  value       = google_cloud_run_v2_service.this.uri
}

output "runtime_service_account_email" {
  description = "Identity the containers run as."
  value       = google_service_account.runtime.email
}

output "runtime_service_account_id" {
  description = "Fully qualified id of the runtime service account, for IAM bindings on it."
  value       = google_service_account.runtime.id
}

output "scaling" {
  description = "Instance bounds actually configured."
  value = {
    min = var.min_instances
    max = var.max_instances
  }
}
