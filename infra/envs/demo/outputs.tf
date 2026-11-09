output "api_url" {
  description = "Public URL of the API."
  value       = module.api.uri
}

output "api_scaling" {
  description = "Instance bounds of the API."
  value       = module.api.scaling
}

output "image_repository" {
  description = "Where the workflow pushes the API image."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "github_workload_identity_provider" {
  description = "To set as the WIF_PROVIDER variable of the GitHub repository."
  value       = module.github_deployer.workload_identity_provider
}

output "github_deployer_service_account" {
  description = "To set as the DEPLOYER_SERVICE_ACCOUNT variable of the GitHub repository."
  value       = module.github_deployer.service_account_email
}

output "github_attribute_condition" {
  description = "Which workflows may obtain GCP credentials."
  value       = module.github_deployer.attribute_condition
}
