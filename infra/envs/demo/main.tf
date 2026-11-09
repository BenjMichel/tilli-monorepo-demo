locals {
  labels = {
    app         = "tilli"
    environment = "demo"
    managed-by  = "opentofu"
  }

  required_apis = [
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "sts.googleapis.com",
  ]
}

resource "google_project_service" "required" {
  for_each = toset(local.required_apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = "tilli"
  format        = "DOCKER"
  description   = "Container images of the Tilli demo"
  labels        = local.labels

  # Images are pinned by digest when deployed, so a tag must never move.
  docker_config {
    immutable_tags = true
  }

  cleanup_policies {
    id     = "keep-recent-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.required]
}

module "api" {
  source = "../../modules/cloud-run-service"

  project_id = var.project_id
  region     = var.region
  name       = "tilli-api"
  image      = var.api_image
  labels     = local.labels
  public     = true

  # The bus, the outboxes and the wave timers live in memory: a second instance would run
  # its own copy of the platform. One instance until the state moves to a database.
  min_instances = 0
  max_instances = 1

  # A demo environment may be torn down at will.
  deletion_protection = false

  depends_on = [google_project_service.required]
}

module "github_deployer" {
  source = "../../modules/github-deployer"

  project_id                 = var.project_id
  region                     = var.region
  github_repository          = var.github_repository
  cloud_run_service_name     = module.api.name
  runtime_service_account_id = module.api.runtime_service_account_id
  artifact_repository_name   = google_artifact_registry_repository.images.repository_id

  depends_on = [google_project_service.required]
}
