variable "project_id" {
  description = "GCP project the workflow deploys to."
  type        = string
}

variable "region" {
  description = "Region of the Cloud Run service and the image repository."
  type        = string
}

variable "github_repository" {
  description = "Repository allowed to deploy, as owner/name."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$", var.github_repository))
    error_message = "Expected owner/name."
  }
}

variable "deploy_ref" {
  description = "Only workflows running on this Git ref may deploy."
  type        = string
  default     = "refs/heads/main"
}

variable "cloud_run_service_name" {
  description = "The only Cloud Run service the deployer may update."
  type        = string
}

variable "runtime_service_account_id" {
  description = "Fully qualified id of the service account the deployed revisions run as."
  type        = string
}

variable "artifact_repository_name" {
  description = "The only Artifact Registry repository the deployer may push to."
  type        = string
}
