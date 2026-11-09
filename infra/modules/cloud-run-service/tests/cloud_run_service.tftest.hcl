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
  region     = "europe-west9"
  name       = "tilli-api"
  image      = "europe-west9-docker.pkg.dev/tilli-test/tilli/api@sha256:0123456789abcdef"
}

run "private_single_instance_by_default" {
  command = apply

  assert {
    condition     = google_cloud_run_v2_service.this.template[0].scaling[0].max_instance_count == 1
    error_message = "A service must default to a single instance."
  }

  assert {
    condition     = length(google_cloud_run_v2_service_iam_member.public_invoker) == 0
    error_message = "A service must not be public unless asked to."
  }

  assert {
    condition     = google_cloud_run_v2_service.this.template[0].service_account == google_service_account.runtime.email
    error_message = "Revisions must run as the dedicated runtime identity, not the default compute account."
  }

  assert {
    condition     = google_cloud_run_v2_service.this.template[0].containers[0].image == var.image
    error_message = "The service must run the requested image."
  }

  assert {
    condition = alltrue([
      google_cloud_run_v2_service.this.template[0].containers[0].startup_probe[0].http_get[0].path == "/health",
      google_cloud_run_v2_service.this.template[0].containers[0].liveness_probe[0].http_get[0].path == "/health",
    ])
    error_message = "Startup and liveness probes must hit /health."
  }
}

run "public_when_asked" {
  command = apply

  variables {
    public = true
  }

  assert {
    condition = (
      google_cloud_run_v2_service_iam_member.public_invoker[0].member == "allUsers" &&
      google_cloud_run_v2_service_iam_member.public_invoker[0].role == "roles/run.invoker"
    )
    error_message = "A public service must let anyone invoke it, and nothing more."
  }
}

run "rejects_zero_instances" {
  command = plan

  variables {
    max_instances = 0
  }

  expect_failures = [var.max_instances]
}

run "rejects_an_invalid_name" {
  command = plan

  variables {
    name = "Tilli_API"
  }

  expect_failures = [var.name]
}
