output "workload_identity_provider" {
  description = "Value of `workload_identity_provider` for google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "service_account_email" {
  description = "Value of `service_account` for google-github-actions/auth."
  value       = google_service_account.deployer.email
}

output "attribute_condition" {
  description = "Which workflows may obtain credentials."
  value       = google_iam_workload_identity_pool_provider.github.attribute_condition
}
