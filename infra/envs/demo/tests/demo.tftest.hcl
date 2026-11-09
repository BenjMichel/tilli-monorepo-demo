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
  project_id = "tilli-test"
  api_image  = "europe-west9-docker.pkg.dev/tilli-test/tilli/api@sha256:0123456789abcdef"
}

run "demo_environment" {
  command = apply

  assert {
    condition     = output.api_scaling.max == 1
    error_message = "The API keeps its state in memory: it must never run more than one instance."
  }

  assert {
    condition     = output.api_scaling.min == 0
    error_message = "The demo should scale to zero when idle."
  }

  assert {
    condition     = output.image_repository == "europe-west9-docker.pkg.dev/tilli-test/tilli"
    error_message = "Images belong to the tilli repository in Paris."
  }

  assert {
    condition     = google_artifact_registry_repository.images.docker_config[0].immutable_tags
    error_message = "Image tags must be immutable."
  }

  assert {
    condition     = output.github_attribute_condition == "assertion.repository == \"BenjMichel/tilli-monorepo-demo\" && assertion.ref == \"refs/heads/main\""
    error_message = "Only main of this repository may deploy."
  }

  assert {
    condition     = contains(keys(google_project_service.required), "run.googleapis.com") && contains(keys(google_project_service.required), "sts.googleapis.com")
    error_message = "Cloud Run and the token exchange (STS) APIs must be enabled."
  }
}
