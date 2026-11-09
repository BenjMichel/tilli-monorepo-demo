# GitHub Actions authenticates with its OIDC token: no service account key to store or leak.
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Without a condition, any GitHub repository could exchange its token against this pool.
  attribute_condition = "assertion.repository == \"${var.github_repository}\" && assertion.ref == \"${var.deploy_ref}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = "github-deployer"
  display_name = "Deploys the API from GitHub Actions"
}

resource "google_service_account_iam_member" "github_impersonates_deployer" {
  service_account_id = google_service_account.deployer.id
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# Every role below is granted on one resource, never on the whole project.
resource "google_artifact_registry_repository_iam_member" "push_images" {
  project    = var.project_id
  location   = var.region
  repository = var.artifact_repository_name
  role       = "roles/artifactregistry.writer"
  member     = google_service_account.deployer.member
}

resource "google_cloud_run_v2_service_iam_member" "deploy_revisions" {
  project  = var.project_id
  location = var.region
  name     = var.cloud_run_service_name
  role     = "roles/run.developer"
  member   = google_service_account.deployer.member
}

# A new revision runs as the runtime identity, so the deployer must be allowed to use it.
resource "google_service_account_iam_member" "deployer_acts_as_runtime" {
  service_account_id = var.runtime_service_account_id
  role               = "roles/iam.serviceAccountUser"
  member             = google_service_account.deployer.member
}
