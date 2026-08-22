# Project Overview & Team Roles

**Project Title:** End-to-End DevOps Pipeline for a Web Application with CI/CD

Short notes for presentation/viva. Full technical detail lives in
`README.md` (setup, gotchas), `architecture-and-concepts.md` (why each
piece exists), and `devops-cicd-guide.md` (build guide, sprint-by-sprint).

---

## Problem Statement

DevOps teams need a CI/CD pipeline that consistently tests, builds, and
deploys changes across environments. This project uses **Jenkins** as
the orchestrator for a Dockerized app deployed to **Kubernetes on AWS
EKS**, with Jenkins also driving infrastructure provisioning and
deployment — removing manual steps end to end.

## Project Goals

1. Application architecture with load balancing, container orchestration, and monitoring on AWS.
2. AWS infrastructure via **Terraform** — VPC, subnets, EKS.
3. Configuration management via **Ansible** (illustrative in this build — see note below).
4. Scalable, resilient app deployment on **EKS**.
5. **Jenkins** CI/CD from code push to production.
6. **Prometheus + Grafana** monitoring for infra and app.

## Tooling

Jenkins · Docker · Terraform · Ansible · `kubectl` · Jenkins plugins (Docker, Kubernetes, AWS CLI/Credentials)

---

## Sprints (short form)

| Sprint | Focus | Status in this build |
|---|---|---|
| 1 | Architecture, Dockerize app, Jenkins server + plugins, Git trigger | ✅ done — see `app/Dockerfile`, `jenkins/Jenkinsfile` |
| 2 | Terraform: VPC/EKS/subnets/security groups, S3 state | ✅ done — see `terraform/`; provisioning run manually, not as a separate Jenkins job |
| 3 | Ansible: configure EC2/Docker/kubectl | ⚠️ playbooks written (`ansible/`) but not wired into Jenkins — Jenkins runs in Docker locally, not on a provisioned EC2 host |
| 4 | CI/CD: build → push ECR → deploy to EKS, health checks, autoscaling | ✅ done — full pipeline in `jenkins/Jenkinsfile`, HPA in `k8s/hpa.yaml` |
| 5 | Prometheus + Grafana, alerting | ✅ done — `monitoring/`, dashboards in `docs/updated-screenshots/` |
| 6 | Testing, documentation, final automation | ✅ done — `README.md`, `architecture-and-concepts.md`, `devops-cicd-guide.md`, screenshot evidence |

## CI/CD Pipeline Stages (actual)

1. **Checkout** — `checkout scm`
2. **Install & Unit Test** — `npm ci`, `npm test`
3. **Build & Push** — `docker buildx build --platform linux/amd64 --push` to ECR
4. **Deploy to EKS** — apply namespace/secrets/deployment/service/hpa/ingress
5. **Verify Rollout** — `kubectl rollout status`

## Deliverables

- End-to-end Jenkins CI/CD pipeline (build → provision → deploy → verify)
- Terraform-provisioned AWS infra (VPC, EKS, ECR)
- Kubernetes deployment on EKS with HPA + ALB Ingress
- Prometheus/Grafana monitoring with Alertmanager rules
- Documentation: setup, architecture rationale, build guide, troubleshooting, full screenshot evidence

## Evaluation Criteria

| Criterion | Weight |
|---|---|
| Documentation | 15% |
| Implementation | 75% |
| Cost Optimization | 10% |

---

## Team Roles

Full team (per GitHub collaborators). Contribution notes are only confirmed
for the two members with commits in this repo's history — the other three
are mapped onto the remaining sprint areas by role and should be confirmed
or corrected by each person before presenting.

| Member | Role | Contribution |
|---|---|---|
| **Avinash Sain** (Owner) | Project Lead — App, CI/CD & Platform | Node.js/Express Task API + frontend, `app/Dockerfile`, Jenkins pipeline (`jenkins/Jenkinsfile`), Kubernetes manifests (`k8s/`), AWS Load Balancer Controller setup, Prometheus/Grafana monitoring (`monitoring/`), and all documentation — confirmed via commit history |
| **Sandeep Gupta** (`sannnn1234`) | Infrastructure — Terraform | AWS infrastructure-as-code updates (`terraform/` — VPC, EKS, ECR modules and environment config) — confirmed via commit history |
| **Siraj** (`Sirajmd1`) | Configuration Management — Ansible | *Unconfirmed* — placeholder assignment: `ansible/` playbooks (Docker/kubectl/AWS CLI setup for EC2 hosts, Sprint 3) |
| **Srishti** (`srishti705`) | Testing & Quality | *Unconfirmed* — placeholder assignment: app test cases, pipeline smoke tests, end-to-end verification (Sprint 6) |
| **Rajeev** | Monitoring & Documentation support | *Unconfirmed* — placeholder assignment: Prometheus/Grafana dashboard curation, screenshot evidence, documentation review |

*Replace the "Unconfirmed" rows with each person's actual scope — they're placeholders inferred from the remaining sprint work, not from repo activity.*

*Update this table with each member's actual scope before presenting, if the above split doesn't match how work was really divided.*
