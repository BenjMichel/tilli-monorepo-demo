variable "project_id" {
  description = "GCP project hosting the service."
  type        = string
}

variable "region" {
  description = "Cloud Run region."
  type        = string
}

variable "name" {
  description = "Service name, also used for its runtime service account."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{3,28}[a-z0-9]$", var.name))
    error_message = "The name must be 5 to 30 lowercase letters, digits or dashes, starting with a letter."
  }
}

variable "image" {
  description = "Container image, ideally pinned by digest."
  type        = string
}

variable "min_instances" {
  description = "Instances kept warm. 0 scales to zero when idle."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Upper bound of instances. Keep it at 1 for an application holding its state in memory."
  type        = number
  default     = 1

  validation {
    condition     = var.max_instances >= 1
    error_message = "At least one instance is needed."
  }
}

variable "cpu" {
  description = "CPU limit of the container."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit of the container."
  type        = string
  default     = "512Mi"
}

variable "env" {
  description = "Plain environment variables. Secrets belong in Secret Manager, not here."
  type        = map(string)
  default     = {}
}

variable "public" {
  description = "Whether anyone on the internet may invoke the service."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Prevents OpenTofu from destroying the service."
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels applied to the service."
  type        = map(string)
  default     = {}
}
