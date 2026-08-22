# DevOps EKS CI/CD Pipeline -- Complete Setup Guide

> End-to-end deployment guide for a Todo List API on **AWS EKS** using
> **Terraform, Docker, Helm, AWS Load Balancer Controller, Prometheus,
> Grafana, and HPA**.

------------------------------------------------------------------------

# Architecture

GitHub → Docker → ECR → Terraform → EKS → Kubernetes → ALB → Prometheus
→ Grafana

------------------------------------------------------------------------

# 1. Prerequisites

## Required tools

``` bash
aws --version
terraform --version
kubectl version --client
helm version
docker --version
eksctl version
```
------------------------------------------------------------------------

# 2. Configure AWS

``` bash
aws configure
aws configure list
aws sts get-caller-identity
```
------------------------------------------------------------------------

# 3. Build & Push Docker Image

Login:

``` bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 251478238405.dkr.ecr.us-east-1.amazonaws.com
```

Build for Apple Silicon compatibility:

``` bash
docker buildx build \
  --platform linux/amd64 \
  -t avinashsain65/devops-eks-cicd-dev-app:latest \
  -t avinashsain65/devops-eks-cicd-dev-app:local \
  --push .
```

Verify:

``` bash
docker images
```
------------------------------------------------------------------------

# 4. Deploy Infrastructure with Terraform

``` bash
cd terraform/environments/dev

terraform init -reconfigure
terraform fmt
terraform validate
terraform plan
terraform apply
```

Type:

``` text
yes
```

Expected output:

``` text
Apply complete!
```

Important outputs:

-   Cluster Name
-   VPC ID
-   ECR URL

------------------------------------------------------------------------

# 5. Configure kubectl

``` bash
aws eks update-kubeconfig \
  --region us-east-1 \
  --name devops-eks-cicd-dev-eks
```

Verify:

``` bash
kubectl config current-context
kubectl get nodes
```

Expected:

``` text
STATUS: Ready
```
------------------------------------------------------------------------

# 6. Deploy Application

``` bash
kubectl apply -f k8s/
```

Verify:

``` bash
kubectl get pods -n devops-demo -o wide
kubectl get svc -n devops-demo
kubectl get endpoints -n devops-demo
```

Expected:

-   Pods Running
-   Service available
-   Endpoints populated

------------------------------------------------------------------------

# 7. Troubleshoot Application

Describe pods:

``` bash
kubectl describe pod -n devops-demo -l app=devops-todo-app
```

Logs:

``` bash
kubectl logs -n devops-demo -l app=devops-todo-app
```

Check ConfigMaps/Secrets:

``` bash
kubectl get deployment devops-todo-app \
-n devops-demo \
-o yaml | grep -A5 -i "configMapKeyRef\|secretKeyRef\|envFrom"
```
------------------------------------------------------------------------

# 8. Install AWS Load Balancer Controller

## Step 1 -- Associate OIDC

``` bash
eksctl utils associate-iam-oidc-provider \
  --region us-east-1 \
  --cluster devops-eks-cicd-dev-eks \
  --approve
```

## Step 2 -- Download IAM Policy

``` bash
curl -o iam-policy.json \
https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json
```

## Step 3 -- Create IAM Policy

``` bash
aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam-policy.json
```

If the policy already exists:

``` bash
aws iam create-policy-version \
  --policy-arn arn:aws:iam::251478238405:policy/AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam-policy.json \
  --set-as-default
```

## Step 4 -- Create IAM ServiceAccount

``` bash
eksctl create iamserviceaccount \
  --cluster devops-eks-cicd-dev-eks \
  --region us-east-1 \
  --namespace kube-system \
  --name aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn arn:aws:iam::251478238405:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve
```

Verify:

``` bash
kubectl get sa aws-load-balancer-controller -n kube-system
kubectl get sa aws-load-balancer-controller \
-n kube-system \
-o yaml | grep eks.amazonaws.com/role-arn
```
------------------------------------------------------------------------

# 9. Important Fix -- OIDC Trust Policy (Real Issue)

During deployment the ALB Controller failed with:

``` text
AccessDenied:
Not authorized to perform sts:AssumeRoleWithWebIdentity
```

Check cluster OIDC:

``` bash
aws eks describe-cluster \
  --region us-east-1 \
  --name devops-eks-cicd-dev-eks \
  --query 'cluster.identity.oidc.issuer' \
  --output text
```

Create trust policy:

``` bash
cat > load-balancer-role-trust-policy.json <<'EOF'
{
  "Version":"2012-10-17",
  "Statement":[{
    "Effect":"Allow",
    "Principal":{
      "Federated":"arn:aws:iam::251478238405:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/A82563E86949A051ACA79A926C7AB00E"
    },
    "Action":"sts:AssumeRoleWithWebIdentity",
    "Condition":{
      "StringEquals":{
        "oidc.eks.us-east-1.amazonaws.com/id/A82563E86949A051ACA79A926C7AB00E:aud":"sts.amazonaws.com",
        "oidc.eks.us-east-1.amazonaws.com/id/A82563E86949A051ACA79A926C7AB00E:sub":"system:serviceaccount:kube-system:aws-load-balancer-controller"
      }
    }
  }]
}
EOF
```

Update IAM Role:

``` bash
aws iam update-assume-role-policy \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --policy-document file://load-balancer-role-trust-policy.json
```

Restart controller:

``` bash
kubectl rollout restart deployment aws-load-balancer-controller -n kube-system
kubectl rollout status deployment aws-load-balancer-controller -n kube-system
```

Verify:

``` bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller --tail=50
```
------------------------------------------------------------------------

# 10. Deploy ALB Ingress

Apply:

``` bash
kubectl apply -f k8s/ingress.yaml
```

Watch:

``` bash
kubectl get ingress devops-todo-app-ingress -n devops-demo -w
```

Verify:

``` bash
kubectl describe ingress devops-todo-app-ingress -n devops-demo
```

Get hostname:

``` bash
kubectl get ingress devops-todo-app-ingress \
-n devops-demo \
-o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

Expected:

``` text
k8s-devopsde-xxxxxxxx.us-east-1.elb.amazonaws.com
```
------------------------------------------------------------------------

# 11. Verify ALB

``` bash
export ALB_ADDRESS=$(kubectl get ingress \
devops-todo-app-ingress \
-n devops-demo \
-o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo $ALB_ADDRESS
```

Health:

``` bash
curl -i http://$ALB_ADDRESS/health
```

API:

``` bash
curl -i http://$ALB_ADDRESS/api/tasks
```

------------------------------------------------------------------------

# 12. Verify Internal Networking

``` bash
kubectl run curl-test \
-n devops-demo \
--image=curlimages/curl:latest \
--rm -it \
--restart=Never \
-- curl -I http://devops-todo-app:80
```

Expected:

``` text
HTTP/1.1 200 OK
```
------------------------------------------------------------------------

# 13. Install Prometheus & Grafana

Add repo:

``` bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

Install:

``` bash
helm upgrade --install monitoring \
prometheus-community/kube-prometheus-stack \
-n monitoring \
--create-namespace \
-f monitoring/prometheus-values.yaml
```

Apply alerts:

``` bash
kubectl apply -f monitoring/alerts.yaml
```

Verify:

``` bash
kubectl get pods -n monitoring
```

Expected:

-   Grafana Running
-   Prometheus Running
-   Alertmanager Running

------------------------------------------------------------------------

# 14. Get Grafana Credentials

Username:

``` bash
kubectl get secret monitoring-grafana \
-n monitoring \
-o jsonpath="{.data.admin-user}" | base64 --decode

echo
```

Password:

``` bash
kubectl get secret monitoring-grafana \
-n monitoring \
-o jsonpath="{.data.admin-password}" | base64 --decode

echo
```

------------------------------------------------------------------------

# 15. Reset Grafana Password

If login fails:

``` bash
helm upgrade monitoring \
prometheus-community/kube-prometheus-stack \
-n monitoring \
-f monitoring/prometheus-values.yaml \
--set grafana.adminUser=admin \
--set grafana.adminPassword='Admin@123456'
```

Restart:

``` bash
kubectl rollout restart deployment monitoring-grafana -n monitoring
kubectl rollout status deployment monitoring-grafana -n monitoring
```

------------------------------------------------------------------------

# 16. Access Grafana

Avoid local Docker conflicts.

Check:

``` bash
docker ps | grep -E "grafana|prometheus"
lsof -i :3000
lsof -i :9090
```

Port-forward:

``` bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

Open:

``` text
http://localhost:3000
```

Login:

``` text
Username: admin
Password: Admin@123456
```

------------------------------------------------------------------------

# 17. Configure Prometheus Data Source

Use:

``` text
http://monitoring-kube-prometheus-prometheus.monitoring:9090
```

**Do NOT use**

``` text
localhost:9090
```

Click:

``` text
Save & Test
```

Expected:

``` text
Successfully queried the Prometheus API
```
------------------------------------------------------------------------

# 18. Access Prometheus

Port-forward:

``` bash
kubectl port-forward \
-n monitoring \
svc/monitoring-kube-prometheus-prometheus \
9090:9090
```

Open:

``` text
http://localhost:9090
```

Run:

``` promql
up
```

Check:

-   Status
-   Targets
------------------------------------------------------------------------

# 19. Load Testing

Install:

``` bash
brew install hey
brew install k6
```

### hey

``` bash
hey -n 1000 -c 50 http://$ALB_ADDRESS/health
```

### Apache Bench

``` bash
ab -n 1000 -c 50 http://$ALB_ADDRESS/health
```

### k6

Create `loadtest.js`

``` javascript
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
};

export default function () {
  const res = http.get('http://YOUR_ALB/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

Run:

``` bash
k6 run loadtest.js
```
------------------------------------------------------------------------

# 20. Watch Auto Scaling

Terminal 1:

``` bash
kubectl get hpa -n devops-demo -w
```

Terminal 2:

``` bash
kubectl get pods -n devops-demo -w
```

Terminal 3:

``` bash
kubectl top pods -n devops-demo
```

Expected:

-   New Pods created
-   HPA replicas increase

------------------------------------------------------------------------

# 21. Final Verification Commands

## AWS

``` bash
aws sts get-caller-identity
```

## EKS

``` bash
kubectl get nodes
```

## Application

``` bash
kubectl get pods -n devops-demo -o wide
kubectl get svc -n devops-demo
kubectl get ingress -n devops-demo
```

## ALB Controller

``` bash
kubectl get pods \
-n kube-system \
-l app.kubernetes.io/name=aws-load-balancer-controller
```

## Monitoring

``` bash
kubectl get pods -n monitoring
```

## Helm

``` bash
helm list -A
```

Expected final state:

  Component    Status
  ------------ ---------
  EKS Nodes    Ready
  App Pods     Running
  ALB          Active
  Controller   Running
  Grafana      Running
  Prometheus   Running

------------------------------------------------------------------------

# 22. Useful Troubleshooting Commands

Application logs:

``` bash
kubectl logs -n devops-demo -l app=devops-todo-app --tail=100
```

Ingress:

``` bash
kubectl describe ingress devops-todo-app-ingress -n devops-demo
```

ALB Controller:

``` bash
kubectl logs \
-n kube-system \
-l app.kubernetes.io/name=aws-load-balancer-controller \
--tail=100
```

Events:

``` bash
kubectl get events -A --sort-by=.lastTimestamp
```

------------------------------------------------------------------------

# 23. Teardown

Remove monitoring:

``` bash
helm uninstall monitoring -n monitoring
```

Remove ALB Controller:

``` bash
helm uninstall aws-load-balancer-controller -n kube-system
```

Remove application:

``` bash
kubectl delete -f k8s/
```

Destroy AWS infrastructure:

``` bash
cd terraform/environments/dev

terraform destroy
```

Type:

``` text
yes
```

------------------------------------------------------------------------

# Notes

-   Build Docker images with `--platform linux/amd64` when using Apple
    Silicon.
-   Use the Kubernetes service DNS for Prometheus inside Grafana, not
    `localhost:9090`.
-   Your working ingress name is `devops-todo-app-ingress`.
-   The AWS Load Balancer Controller required updating the IAM trust
    policy to match the cluster's current OIDC provider.
