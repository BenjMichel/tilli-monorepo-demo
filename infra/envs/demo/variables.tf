variable "project_id" {
  description = "GCP project of the demo environment."
  type        = string
}

variable "region" {
  description = "Region of every regional resource. europe-west9 is Paris."
  type        = string
  default     = "europe-west9"
}

variable "api_image" {
  description = "Image of the API to run, set by the deployment workflow (pinned by digest)."
  type        = string
}

variable "github_repository" {
  description = "Repository allowed to deploy, as owner/name."
  type        = string
  default     = "BenjMichel/tilli-monorepo-demo"
}
