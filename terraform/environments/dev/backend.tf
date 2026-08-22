terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Run scripts/bootstrap-backend.sh once
  # to create the S3 bucket before the first `terraform init`.
  backend "s3" {
    bucket       = "devops-terraform-state-sandeep-2026"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region
}