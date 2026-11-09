# A dedicated identity per service, with no project role: least privilege by default.
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.name
  display_name = "Runtime identity of the ${var.name} Cloud Run service"
}

resource "google_cloud_run_v2_service" "this" {
  project             = var.project_id
  location            = var.region
  name                = var.name
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.deletion_protection
  labels              = var.labels

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        # CPU only while serving requests: the cheapest mode, fine for a demo.
        cpu_idle = true
      }

      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.public ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
