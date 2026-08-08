terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Run scripts/bootstrap-backend.sh once (creates the S3 bucket + DynamoDB
  # lock table) BEFORE the first `terraform init`, then fill in the values below.
  backend "s3" {
    bucket         = "devops-eks-tfstate-<UNIQUE-SUFFIX>"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}
