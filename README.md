# devops-eks-cicd-pipeline

End-to-end DevOps pipeline: a Node.js API, Dockerized, deployed to AWS EKS,
provisioned with Terraform, configured with Ansible, orchestrated by Jenkins
(exposed via ngrok for local development), and monitored with
Prometheus/Grafana. Built and tuned to stay cost-optimized on AWS.

**Suggested git repo name:** `devops-eks-cicd-pipeline`

```bash
git init
git add .
git commit -m "Initial commit: full DevOps CI/CD pipeline scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/devops-eks-cicd-pipeline.git
git push -u origin main
```

## Repo layout

```
devops-eks-cicd-pipeline/
├── app/                    # Node.js/Express Task API (the demo workload) — real, tested code
│   ├── server.js
│   ├── routes/tasks.js
│   ├── test/server.test.js
│   ├── Dockerfile
│   └── package.json
├── terraform/
│   ├── modules/
│   │   ├── vpc/            # VPC, subnets, single NAT (cost-optimized)
│   │   ├── eks/            # EKS control plane + Spot managed node group
│   │   └── ecr/            # ECR repo + lifecycle policy
│   └── environments/dev/   # wires the modules together for the dev env
├── ansible/
│   ├── playbook.yml
│   └── roles/{jenkins,docker,kubectl,awscli}/
├── jenkins/
│   ├── Jenkinsfile         # build → test → push → deploy → verify
│   └── setup-ngrok.md      # expose local Jenkins to GitHub webhooks
├── k8s/                    # namespace, deployment, service, HPA, ingress
├── monitoring/             # Prometheus/Grafana Helm values + alert rules
└── scripts/
    ├── bootstrap-backend.sh    # one-time: create S3+DynamoDB for TF state
    ├── setup-budget-alert.sh   # one-time: AWS Budget alert at $50/mo
    └── teardown.sh             # run every session end — biggest cost lever
```

## Quick start

### 1. One-time setup
```bash
./scripts/bootstrap-backend.sh <your-unique-bucket-name> us-east-1
./scripts/setup-budget-alert.sh <AWS_ACCOUNT_ID> you@example.com
```
Paste the bucket name into `terraform/environments/dev/backend.tf`.

### 2. Provision infrastructure
```bash
cd terraform/environments/dev
terraform init
terraform plan
terraform apply
```

### 3. Configure servers with Ansible
```bash
cd ansible
# fill in real IPs in inventory.ini first
ansible-playbook playbook.yml
```

### 4. Set up Jenkins
- If Jenkins runs locally: follow `jenkins/setup-ngrok.md` to expose it to GitHub.
- If Jenkins runs on the EC2 box Ansible just configured: point its security
  group / Elastic IP at GitHub directly (no ngrok needed).
- Create a Pipeline job pointing at this repo, script path `jenkins/Jenkinsfile`.
- Add these Jenkins credentials before the first build:
  - `ecr-repo-url` (Secret text) — the ECR URL from `terraform output ecr_repository_url`
  - AWS credentials with EKS + ECR permissions (via the AWS Credentials plugin)

### 5. Push code → pipeline runs automatically
Build → unit test (Jest) → Docker build → push to ECR → deploy to EKS → verify rollout.

### 6. Install monitoring
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace -f monitoring/prometheus-values.yaml
kubectl apply -f monitoring/alerts.yaml
```

### 7. End of every session
```bash
./scripts/teardown.sh
```
This is the most important script in the repo for staying cost-optimized —
an idle EKS cluster + NAT gateway bills whether you're using it or not.

## App API reference (for testing the deployment)
| Method | Path | Description |
|---|---|---|
| GET | `/health` | health check (used by k8s probes) |
| GET | `/` | service info |
| GET | `/api/tasks` | list tasks |
| POST | `/api/tasks` | create a task (`{ "title": "..." }`) |
| PATCH | `/api/tasks/:id/done` | mark a task done |
| DELETE | `/api/tasks/:id` | delete a task |

## Cost notes
See `monitoring/prometheus-values.yaml`, the Terraform modules, and
`scripts/teardown.sh` — every 💰 comment marks a deliberate cost-optimization
choice (Spot nodes, single NAT, no Grafana persistence, short log/metric
retention, ECR lifecycle policy, in-cluster or local+ngrok Jenkins instead
of a dedicated always-on EC2 box).
