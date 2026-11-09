terraform {
  required_version = ">= 1.10"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }

  # Partial configuration: the bucket is given at init time, see README.
  #   tofu init -backend-config="bucket=<state-bucket>"
  backend "gcs" {
    prefix = "tilli/demo"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
