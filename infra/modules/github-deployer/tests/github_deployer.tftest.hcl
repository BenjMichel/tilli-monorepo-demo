# Runs against a mocked Google provider: no credentials, no cost, no cloud call.
mock_provider "google" {
  # Computed attributes the provider validates need realistic values, not random strings.
  mock_resource "google_service_account" {
    defaults = {
      id     = "projects/tilli-test/serviceAccounts/mocked@tilli-test.iam.gserviceaccount.com"
      email  = "mocked@tilli-test.iam.gserviceaccount.com"
      member = "serviceAccount:mocked@tilli-test.iam.gserviceaccount.com"
    }
  }
}

variables {
  project_id                 = "tilli-test"
  region                     = "europe-west9"
  github_repository          = "BenjMichel/tilli-monorepo-demo"
  cloud_run_service_name     = "tilli-api"
  runtime_service_account_id = "projects/tilli-test/serviceAccounts/tilli-api@tilli-test.iam.gserviceaccount.com"
  artifact_repository_name   = "tilli"
}

run "only_the_main_branch_of_this_repository_gets_credentials" {
  command = apply

  assert {
    condition     = google_iam_workload_identity_pool_provider.github.attribute_condition == "assertion.repository == \"BenjMichel/tilli-monorepo-demo\" && assertion.ref == \"refs/heads/main\""
    error_message = "Only workflows of this repository running on main may exchange their token."
  }

  assert {
    condition     = google_iam_workload_identity_pool_provider.github.oidc[0].issuer_uri == "https://token.actions.githubusercontent.com"
    error_message = "The pool must trust GitHub's OIDC issuer only."
  }

  assert {
    condition     = endswith(google_service_account_iam_member.github_impersonates_deployer.member, "/attribute.repository/BenjMichel/tilli-monorepo-demo")
    error_message = "Only this repository may impersonate the deployer."
  }
}

run "least_privilege" {
  command = apply

  assert {
    condition = (
      google_artifact_registry_repository_iam_member.push_images.role == "roles/artifactregistry.writer" &&
      google_artifact_registry_repository_iam_member.push_images.repository == "tilli"
    )
    error_message = "The deployer may push to the image repository of the app only."
  }

  assert {
    condition = (
      google_cloud_run_v2_service_iam_member.deploy_revisions.role == "roles/run.developer" &&
      google_cloud_run_v2_service_iam_member.deploy_revisions.name == "tilli-api"
    )
    error_message = "The deployer may update the API service only."
  }

  assert {
    condition     = google_service_account_iam_member.deployer_acts_as_runtime.service_account_id == var.runtime_service_account_id
    error_message = "The deployer may act as the runtime identity only."
  }
}

run "rejects_a_malformed_repository" {
  command = plan

  variables {
    github_repository = "not a repository"
  }

  expect_failures = [var.github_repository]
}
