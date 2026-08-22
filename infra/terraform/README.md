# Terraform Deployment (Cloud Run)

This folder provisions Google Cloud infrastructure for the backend.

## What it creates

- Required APIs: Cloud Run + Artifact Registry
- One Cloud Run v2 service
- Optional public invoker permission

## Prerequisites

- Terraform >= 1.6
- Google Cloud CLI authenticated
- A container image already built and published

## Usage

1. Copy vars file:

```bash
cp terraform.tfvars.example terraform.tfvars
```

2. Edit `terraform.tfvars` with your project and image URL.

3. Apply:

```bash
terraform init
terraform plan
terraform apply
```

## Notes

- This module only provisions infrastructure.
- Secrets such as `GEMINI_API_KEY` should be injected via Secret Manager or your CI/CD pipeline.
- If you want private access only, set `allow_unauthenticated = false`.
