terraform {
  required_version = ">= 1.6.0"

  # El state vive en un bucket, no en la maquina. Va vacio a proposito: el
  # nombre del bucket lleva el project id y este repo es publico, asi que se
  # pasa aparte con `terraform init -backend-config=backend.hcl` (ese archivo
  # esta en .gitignore; hay un backend.hcl.example al lado).
  backend "gcs" {}

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}
