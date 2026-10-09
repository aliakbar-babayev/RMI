# Project RMAI — Google Cloud Vertex AI & Proxmox CT216 Deployment Manual
**Target Model:** `gemma2-9b-rmi` (Fine-tuned Gemma 2 9B for Risk Management)  
**Google Cloud Project:** `rma-app-511110` (Project Number: `290165218571`, Region: `us-central1`)  
**On-Premises Infrastructure:** Proxmox VE 9.2 (PVE215) — LXC Container 216 (`rmi.sysadmin.az` / `192.168.10.35`)  

---

## 1. Executive Summary & Architecture Overview

Project RMAI (Risk Management AI) is an enterprise-grade, auditable decision-support platform conforming to **ISO 31000** and **PMI PMBOK** standards. It transforms unstructured project communications into structured, evidence-backed risk registers, 5×5 heatmaps, and cryptographic audit trails.

### Inference & Deployment Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT ACCESS & ROUTING                         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS :443 (Let's Encrypt *.sysadmin.az)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│             PROXMOX VE PVE215 — LXC CT 216 (192.168.10.35)             │
│                                                                        │
│  ┌───────────────────────┐         ┌────────────────────────────────┐  │
│  │ Nginx Reverse Proxy   │ ──/───► │ Stitch UI (React 19 / Vite)    │  │
│  │ (Port 80 ➔ 443 301)   │ ──/api/►│ FastAPI Backend (:8000)        │  │
│  └───────────────────────┘         └───────────────┬────────────────┘  │
│                                                    │                   │
│                                    SQLite + Append-Only SHA-256 Chain  │
└────────────────────────────────────────────────────┼───────────────────┘
                                                     │
               ┌─────────────────────────────────────┴─────────────────────────────────────┐
               ▼                                                                           ▼
┌──────────────────────────────────────────────┐        ┌────────────────────────────────────────────────┐
│           CLOUD MODE A: VERTEX AI            │        │           CLOUD MODE B: EXPRESS API            │
│          DEDICATED vLLM ENDPOINT             │        │                  GEMINI 2.5                    │
├──────────────────────────────────────────────┤        ├────────────────────────────────────────────────┤
│ • Model: gemma2-9b-rmi-vllm                  │        │ • Model: gemini-2.5-flash                      │
│ • Container: pytorch-vllm-serve              │        │ • Endpoint: :generateContent                   │
│ • Hardware: 1x NVIDIA L4 (g2-standard-8)     │        │ • Auth: GCP_API_KEY (AQ.Ab8RN6...)             │
│ • Auth: Service Account ADC (gcp-sa-key.json)│        │ • Latency: Sub-second, zero GPU idle cost      │
│ • Endpoint ID: 7412375780593762304           │        └────────────────────────────────────────────────┘
└──────────────────────────────────────────────┘
```

---

## 2. Google Cloud Infrastructure & Model Artifacts

| Resource | Value / Identifier | Purpose |
|---|---|---|
| **GCP Project ID** | `rma-app-511110` | Project identifier |
| **GCP Project Number** | `290165218571` | IAM and Resource prefix |
| **Serving Region** | `us-central1` | Primary low-latency ML region |
| **GCS Bucket** | `gs://rma-app-511110-ml-data` | Datasets, LoRA adapters, model weights |
| **Merged Model Weights** | `gs://rma-app-511110-ml-data/models/gemma2-9b-rmi-merged/` | 17.23 GiB standalone Safetensors |
| **LoRA Adapter Weights** | `gs://rma-app-511110-ml-data/models/gemma2-9b-rmi-lora/` | `adapter_model.safetensors` (216 MB) |
| **Model Registry ID** | `1917803915294801920` (`gemma2-9b-rmi-vllm`) | Fixed vLLM entrypoint model registration |
| **Vertex AI Endpoint ID**| `7412375780593762304` | Serving endpoint for NVIDIA L4 |
| **Endpoint Resource Name** | `projects/290165218571/locations/us-central1/endpoints/7412375780593762304` | Full SDK target URI |

---

## 3. Vertex AI Model Fix & vLLM Serving Registration

### 3.1. The Root Cause of Initial Model Crashes
When uploading custom model weights to Vertex AI Model Garden using container image:
`us-docker.pkg.dev/vertex-ai/vertex-vision-model-garden-dockers/pytorch-vllm-serve:latest`

Vertex AI uses a wrapper script (`gcs_download_launcher.sh`) that downloads model artifacts from GCS into `/gcs/...` or local storage and subsequently executes the container command.
* **The Failure:** If `--container-command` is omitted, the wrapper invokes an empty command string and defaults to attempting to execute the model folder path directly as an ELF binary, throwing an execution error and terminating the container immediately.
* **The Solution:** Explicitly specify `--container-command` and `--container-args` defining the Python vLLM API server entrypoint.

### 3.2. Correct Model Registration Command
```bash
gcloud ai models upload \
  --project=rma-app-511110 \
  --region=us-central1 \
  --display-name=gemma2-9b-rmi-vllm \
  --artifact-uri=gs://rma-app-511110-ml-data/models/gemma2-9b-rmi-merged \
  --container-image-uri=us-docker.pkg.dev/vertex-ai/vertex-vision-model-garden-dockers/pytorch-vllm-serve:latest \
  --container-command="python3,-m,vllm.entrypoints.api_server" \
  --container-args="--port=8080,--dtype=bfloat16,--gpu-memory-utilization=0.9" \
  --container-ports=8080 \
  --container-predict-route=/generate \
  --container-health-route=/health
```

### 3.3. Deploy Model to NVIDIA L4 Accelerator Endpoint
```bash
gcloud ai endpoints deploy-model 7412375780593762304 \
  --model=1917803915294801920 \
  --region=us-central1 \
  --project=rma-app-511110 \
  --display-name=gemma2-9b-rmi-vllm-l4 \
  --machine-type=g2-standard-8 \
  --accelerator=type=nvidia-l4,count=1
```

---

## 4. Authentication Matrix: API Key vs. Service Account (ADC)

A critical architectural distinction exists between Express REST mode and Custom Endpoint mode:

| Dimension | Mode 1: Express REST Mode | Mode 2: Dedicated Endpoint Mode (`gemma2-9b-rmi`) |
|---|---|---|
| **Models Supported** | Pre-built Google foundation models (`gemini-2.5-flash`, etc.) | Custom fine-tuned models on Vertex AI Endpoints |
| **Authentication** | `GCP_API_KEY` (`AQ.Ab8RN6...`) via header `x-goog-api-key` | Google Application Default Credentials (**ADC**) |
| **Token Mechanism** | Static API Key | OAuth 2.0 Bearer tokens signed by Service Account |
| **SDK Method** | Direct HTTPS POST to `:generateContent` | `google.cloud.aiplatform.Endpoint.predict()` |
| **IAM Permission** | API Key enablement | Role `roles/aiplatform.user` on `rma-app-511110` |

> [!CAUTION]
> **Why `GCP_API_KEY` cannot call `gemma2-9b-rmi`:**  
> Google Cloud strictly disallows API keys for custom deployed Vertex AI endpoints. Any external application (such as your Proxmox CT 216 or Render backend) invoking `Endpoint.predict()` must present an OAuth 2.0 token derived from a Service Account JSON key.

### 4.1. Generating the Service Account Credentials (via Cloud Shell)
In [Google Cloud Shell](https://shell.cloud.google.com/?project=rma-app-511110), run:

```bash
# 1. Create dedicated Service Account
gcloud iam service-accounts create rmi-vertex-sa \
    --project=rma-app-511110 \
    --description="Service account for RMI backend to call Vertex AI endpoints" \
    --display-name="rmi-vertex-sa"

# 2. Grant Vertex AI User role
gcloud projects add-iam-policy-binding rma-app-511110 \
    --member="serviceAccount:rmi-vertex-sa@rma-app-511110.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# 3. Export JSON key
gcloud iam service-accounts keys create gcp-sa-key.json \
    --iam-account=rmi-vertex-sa@rma-app-511110.iam.gserviceaccount.com \
    --project=rma-app-511110

# 4. View or download the key
cat gcp-sa-key.json
```

---

## 5. Proxmox LXC Container Deployment (CT 216)

### 5.1. Container Specifications & Network
* **Proxmox Host:** PVE215 (`192.168.10.180`)
* **Container ID:** `216`
* **Hostname:** `rmi.sysadmin.az`
* **Static IP:** `192.168.10.35/24` (Gateway: `192.168.10.1`, DNS: `192.168.10.5 192.168.10.1`)
* **Resources:** 4 vCPU, 4096 MB RAM, 2048 MB Swap, 25 GB NVMe on `nvme-fast-2tb`
* **OS:** Ubuntu 24.04 LTS (Noble Numbat)
* **Configuration Invariants:** `nesting=1,keyctl=1`, `unprivileged=1`, `onboot=1`

### 5.2. Service & Application Directory Layout
```
/opt/rmi/
├── backend/
│   ├── .env                      # Application configuration & secrets
│   ├── gcp-sa-key.json           # Google Cloud Service Account key (chmod 600)
│   ├── rm_ai.db                  # SQLite database with append-only triggers
│   ├── .venv/                    # Python 3.12 virtual environment (Astral uv)
│   ├── app/
│   │   ├── main.py               # FastAPI entrypoint
│   │   ├── ai/client.py          # Unified Vertex AI / Gemini / Ollama client
│   │   └── services/             # Deterministic scoring, verification, audit log
│   └── tests/                    # 114 Pytest test cases
└── frontend-stitch/
    ├── dist/                     # Optimized production bundle (React 19, Vite)
    └── src/                      # Stitch full-module UI source
```

---

## 6. SSL/TLS Wildcard Certificate Integration

### 6.1. Certificate Structure & Assembly
The certificate set located in `~/Documents/Mountaineering.az_new/Let's_Encrypt_11-2026/` contains:
* `star_sysadmin_az.crt`: Leaf certificate (Subject: `CN = *.ssd.az`, SANs: `*.sysadmin.az`, `sysadmin.az`, etc.)
* `star_sysadmin_az.bundle`: Intermediate CA chain (YR1 + ISRG Root YR)
* `star_sysadmin_az.key`: Private RSA key (Modulus MD5: `d4f88cd150ac38e08727d8a2f84b0079`)

> [!IMPORTANT]
> **Nginx Certificate Order Invariant:**  
> Nginx requires the leaf certificate to be listed **first**, followed by intermediate CAs. Using `star_sysadmin_az.bundle` alone causes `SSL_CTX_use_PrivateKey: key values mismatch`.  
> The correct bundle must be assembled as:  
> `cat leaf.crt chain.crt > /etc/nginx/ssl/fullchain.crt`

### 6.2. Nginx Configuration (`/etc/nginx/sites-available/rmi`)
```nginx
# HTTP: Redirect all traffic to HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name rmi.sysadmin.az 192.168.10.35 _;

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS: Production SSL Server Block
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name rmi.sysadmin.az 192.168.10.35 _;

    # Let's Encrypt Fullchain & Key
    ssl_certificate /etc/nginx/ssl/fullchain.crt;
    ssl_certificate_key /etc/nginx/ssl/star_sysadmin_az.key;

    # Secure Protocol & Cipher Suites
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # HSTS & Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;

    root /opt/rmi/frontend-stitch/dist;
    index index.html;

    # Backend API reverse proxy (strips /api prefix)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # Direct Health Check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Single Page App routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 7. Backend Configuration & Service Management

### 7.1. Environment File (`/opt/rmi/backend/.env`)

#### Configuration for Dedicated Endpoint (`gemma2-9b-rmi` on L4 GPU):
```env
# Database
DATABASE_URL=sqlite:///./rm_ai.db

# AI Provider Configuration
AI_PROVIDER=vertex
GCP_PROJECT_ID=rma-app-511110
GCP_LOCATION=us-central1

# Service Account Application Default Credentials
GOOGLE_APPLICATION_CREDENTIALS=/opt/rmi/backend/gcp-sa-key.json

# Vertex AI Dedicated Endpoint
VERTEX_ENDPOINT_ID=projects/290165218571/locations/us-central1/endpoints/7412375780593762304
VERTEX_MODEL=google/gemma-2-9b-it

# Operational Guardrails
AI_TIMEOUT_SECONDS=300
MAX_INPUT_CHARS=20000
CONFIDENCE_REVIEW_THRESHOLD=0.7
CORS_ORIGINS=["*"]
```

#### Configuration for Express Mode (`gemini-2.5-flash` Fallback):
```env
# Database
DATABASE_URL=sqlite:///./rm_ai.db

# AI Provider Configuration
AI_PROVIDER=vertex
GCP_PROJECT_ID=rma-app-511110
GCP_LOCATION=us-central1
GCP_API_KEY=YOUR_GCP_API_KEY

VERTEX_MODEL=gemini-2.5-flash
VERTEX_THINKING_BUDGET=0

# Operational Guardrails
AI_TIMEOUT_SECONDS=300
MAX_INPUT_CHARS=20000
CONFIDENCE_REVIEW_THRESHOLD=0.7
CORS_ORIGINS=["*"]
```

### 7.2. Systemd Service Definition (`/etc/systemd/system/rmi-backend.service`)
```ini
[Unit]
Description=RMI Backend FastAPI Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rmi/backend
EnvironmentFile=/opt/rmi/backend/.env
ExecStart=/opt/rmi/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

---

## 8. Verification & Operational Health Check Runbook

### 8.1. Health Endpoint Verification
```bash
# Check over HTTPS:
curl -s https://rmi.sysadmin.az/health
# With dedicated endpoint:
# {"ok":true,"model":"vertex:endpoint/projects/290165218571/locations/us-central1/endpoints/7412375780593762304"}
# With Express API:
# {"ok":true,"model":"vertex:gemini-2.5-flash"}
```

### 8.2. Cryptographic Audit Ledger Verification
```bash
curl -s https://rmi.sysadmin.az/api/audit/verify
# Expected Output:
# {"ok":true,"checked":3,"broken_at":null,"duration_ms":0.54}
```

### 8.3. Live Analysis Pipeline Test (ISO 31000 Azerbaijani Output)
```bash
curl -s -X POST https://rmi.sysadmin.az/api/analyses \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Sprint 4 retrospective: The payment gateway migration is delayed by 3 weeks due to third-party vendor API instability, which may cause schedule slippage and missed regulatory compliance deadlines.",
    "language_hint": "en",
    "source": "vendor-api"
  }'
```

**Expected JSON Response:**
* Validated Condition-Cause-Effect syntax in Azerbaijani:
  `"[səbəb] səbəbindən [hadisə] baş verə bilər və bu, [təsir] ilə nəticələnə bilər."`
* Exact character-offset quote verification: `{"verified": true, "start": 24, "end": 196}`
* Deterministic mathematical scoring: `P=5, I=4, Score=20, Level="critical"`
* Status: `"pending"` for Human-in-the-Loop review
* Immutable event record committed to SQLite audit chain with new SHA-256 digest
