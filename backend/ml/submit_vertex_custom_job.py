"""Submits a Custom Fine-Tuning Job to Google Cloud Vertex AI.

Target Model: google/gemma-2-9b-it (Risk Management LLM)
Target Project: rma-app-511110
Target Region: us-central1
Training Data: gs://rma-app-511110-ml-data/datasets/sft_train_500.jsonl
Artifact Output: gs://rma-app-511110-ml-data/models/gemma2-9b-rmi-lora/

Accelerators Supported:
- a100-80gb (FASTEST RAW SPEED: a2-ultragpu-1g with NVIDIA_A100_80GB, ~4-6 min training)
- a100-40gb (a2-highgpu-1g with NVIDIA_TESLA_A100, ~7-10 min training)
- l4 (BALANCED/QUICK APPROVAL: g2-standard-8 with NVIDIA_L4, ~15-20 min training)
- t4 (BUDGET: n1-standard-8 with NVIDIA_TESLA_T4, ~35-45 min training)
"""

import argparse
import sys
from pathlib import Path
from google.cloud import aiplatform, storage

ACCELERATOR_CONFIGS = {
    "a100-80gb": {
        "machine_type": "a2-ultragpu-1g",
        "accelerator_type": "NVIDIA_A100_80GB",
        "accelerator_count": 1,
        "quota_metric": "aiplatform.googleapis.com/custom_model_training_nvidia_a100_80gb_gpus",
        "batch_size": 4,
        "grad_accum": 4,
        "fast_mode": True,
    },
    "a100": {
        "machine_type": "a2-ultragpu-1g",
        "accelerator_type": "NVIDIA_A100_80GB",
        "accelerator_count": 1,
        "quota_metric": "aiplatform.googleapis.com/custom_model_training_nvidia_a100_80gb_gpus",
        "batch_size": 4,
        "grad_accum": 4,
        "fast_mode": True,
    },
    "a100-40gb": {
        "machine_type": "a2-highgpu-1g",
        "accelerator_type": "NVIDIA_TESLA_A100",
        "accelerator_count": 1,
        "quota_metric": "aiplatform.googleapis.com/custom_model_training_nvidia_a100_gpus",
        "batch_size": 2,
        "grad_accum": 8,
        "fast_mode": False,
    },
    "l4": {
        "machine_type": "g2-standard-8",
        "accelerator_type": "NVIDIA_L4",
        "accelerator_count": 1,
        "quota_metric": "aiplatform.googleapis.com/custom_model_training_nvidia_l4_gpus",
        "batch_size": 2,
        "grad_accum": 8,
        "fast_mode": False,
    },
    "t4": {
        "machine_type": "n1-standard-8",
        "accelerator_type": "NVIDIA_TESLA_T4",
        "accelerator_count": 1,
        "quota_metric": "aiplatform.googleapis.com/custom_model_training_nvidia_t4_gpus",
        "batch_size": 1,
        "grad_accum": 16,
        "fast_mode": False,
    },
}


def verify_preflight(project_id: str, region: str, dataset_uri: str, bucket_name: str) -> bool:
    """Performs preflight verification before submitting job."""
    print("----------------------------------------------------------------")
    print("▶ Step 1: Pre-flight Verification")
    print("----------------------------------------------------------------")

    # 1. Verify GCS Dataset
    try:
        storage_client = storage.Client(project=project_id)
        bucket = storage_client.bucket(bucket_name)
        blob_path = dataset_uri.replace(f"gs://{bucket_name}/", "")
        blob = bucket.blob(blob_path)
        if not blob.exists():
            print(f"❌ Error: Dataset {dataset_uri} does not exist in bucket {bucket_name}.")
            return False
        blob.reload()
        size_kb = blob.size / 1024
        print(f"✓ GCS Training Dataset verified: {dataset_uri} ({size_kb:.1f} KB)")
    except Exception as e:
        print(f"❌ Storage error: {e}")
        return False

    # 2. Verify Vertex AI Initialization
    try:
        aiplatform.init(project=project_id, location=region, staging_bucket=f"gs://{bucket_name}/staging")
        print(f"✓ Vertex AI SDK initialized for project {project_id} in {region}")
    except Exception as e:
        print(f"❌ Vertex AI init error: {e}")
        return False

    return True


def submit_vertex_training_job(
    project_id: str = "rma-app-511110",
    region: str = "us-central1",
    bucket_name: str = "rma-app-511110-ml-data",
    dataset_uri: str = "gs://rma-app-511110-ml-data/datasets/sft_train_500.jsonl",
    output_uri: str = "gs://rma-app-511110-ml-data/models/gemma2-9b-rmi-lora/",
    base_model: str = "google/gemma-2-9b-it",
    accelerator: str = "a100-80gb",
    epochs: int = 3,
    hf_token: str | None = None,
):
    """Packages and submits custom fine-tuning job to Vertex AI with requested accelerator."""
    acc_key = accelerator.lower()
    if acc_key not in ACCELERATOR_CONFIGS:
        raise ValueError(f"Unknown accelerator '{accelerator}'. Choose from: {list(ACCELERATOR_CONFIGS.keys())}")

    acc_spec = ACCELERATOR_CONFIGS[acc_key]
    machine_type = acc_spec["machine_type"]
    accelerator_type = acc_spec["accelerator_type"]
    accelerator_count = acc_spec["accelerator_count"]
    batch_size = acc_spec["batch_size"]
    grad_accum = acc_spec["grad_accum"]

    print("================================================================")
    print("Project RMAI — Ultra-Fast Vertex AI Fine-Tuning Launcher")
    print("Model:            " + base_model)
    print("Project:          " + project_id)
    print("Region:           " + region)
    print("Accelerator Tier: " + acc_key.upper())
    print("Compute Machine:  " + f"{machine_type} with {accelerator_count}x {accelerator_type}")
    print("Batch / Accum:    " + f"batch={batch_size}, grad_accum={grad_accum}")
    print("Training Dataset: " + dataset_uri)
    print("Output GCS Path:  " + output_uri)
    print("================================================================")

    if not verify_preflight(project_id, region, dataset_uri, bucket_name):
        print("Pre-flight checks failed. Aborting job submission.")
        return None

    # Upload training script to staging
    storage_client = storage.Client(project=project_id)
    bucket = storage_client.bucket(bucket_name)
    script_blob = bucket.blob("scripts/train_gemma_lora.py")
    local_script = Path(__file__).parent / "train_gemma_lora.py"

    if local_script.exists():
        script_blob.upload_from_filename(str(local_script))
        print(f"✓ Uploaded training engine to gs://{bucket_name}/scripts/train_gemma_lora.py")

    display_name = f"rma-gemma-2-9b-{acc_key}-{base_model.replace('/', '-').replace('@', '-')}"

    # Container commands to install stable PEFT/transformers and run training
    hf_env = f"export HF_TOKEN={hf_token} && " if hf_token else ""
    actual_model = base_model if (hf_token or not base_model.startswith("google/")) else "unsloth/gemma-2-9b-it"
    run_command = (
        f"{hf_env}"
        f"export CUDA_VISIBLE_DEVICES=0 && "
        f"export USE_TORCH_XLA=0 && "
        f"unset PJRT_DEVICE && "
        f"pip install --quiet 'transformers==4.43.3' 'peft==0.12.0' 'accelerate==0.33.0' 'datasets==2.20.0' google-cloud-storage && "
        f"gsutil cp gs://{bucket_name}/scripts/train_gemma_lora.py /tmp/train_gemma_lora.py && "
        f"python3 /tmp/train_gemma_lora.py "
        f"--base-model {actual_model} "
        f"--train-file {dataset_uri} "
        f"--output-dir {output_uri} "
        f"--epochs {epochs} "
        f"--batch-size {batch_size} "
        f"--grad-accum {grad_accum} "
        f"--lora-rank 16 "
        f"--lora-alpha 32 "
        f"--max-seq-len 2048"
    )

    worker_pool_specs = [
        {
            "machine_spec": {
                "machine_type": machine_type,
                "accelerator_type": accelerator_type,
                "accelerator_count": accelerator_count,
            },
            "replica_count": 1,
            "container_spec": {
                "image_uri": "us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-2.py310:latest",
                "command": ["/bin/bash", "-c"],
                "args": [run_command],
            },
        }
    ]

    print("\n----------------------------------------------------------------")
    print(f"▶ Step 2: Submitting Vertex AI Custom Job on {accelerator_type}...")
    print("----------------------------------------------------------------")

    job = aiplatform.CustomJob(
        display_name=display_name,
        worker_pool_specs=worker_pool_specs,
        staging_bucket=f"gs://{bucket_name}/staging",
    )

    try:
        job.submit()
        print("\n----------------------------------------------------------------")
        print("▶ Step 3: Job Submission Confirmed!")
        print("----------------------------------------------------------------")
        print(f"Job Resource Name: {job.resource_name}")
        print(f"Job State:         {job.state}")
        print(f"Vertex AI Console: https://console.cloud.google.com/vertex-ai/training/custom-jobs?project={project_id}")
        print(f"Storage Artifacts: https://console.cloud.google.com/storage/browser/{bucket_name}/models")
        print("----------------------------------------------------------------\n")
        return job
    except Exception as exc:
        quota_metric = acc_spec["quota_metric"]
        print(f"\n❌ Submission halted due to quota limit: {exc}")
        print(f"\nTo unlock this accelerator, request quota in Google Cloud Console:")
        print(f"👉 Direct URL: https://console.cloud.google.com/iam-admin/quotas?project={project_id}")
        print(f"👉 Service:    Vertex AI API (aiplatform.googleapis.com)")
        print(f"👉 Metric:     {quota_metric}")
        print(f"👉 Region:     {region}")
        print(f"👉 Requested:  1")
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Submit ultra-fast Gemma fine-tuning job to Vertex AI")
    parser.add_argument("--project", default="rma-app-511110", help="Google Cloud Project ID")
    parser.add_argument("--region", default="us-central1", help="Vertex AI Region")
    parser.add_argument("--bucket", default="rma-app-511110-ml-data", help="GCS Bucket Name")
    parser.add_argument("--model", default="google/gemma-2-9b-it", help="Base Gemma Model")
    parser.add_argument("--dataset", default="gs://rma-app-511110-ml-data/datasets/sft_train_500.jsonl", help="Training Dataset GCS URI")
    parser.add_argument("--accelerator", default="a100-80gb", choices=["a100-80gb", "a100", "a100-40gb", "l4", "t4"], help="Accelerator tier")
    parser.add_argument("--epochs", type=int, default=3, help="Training Epochs")
    parser.add_argument("--hf-token", default=None, help="HuggingFace token for gated models")

    args = parser.parse_args()
    submit_vertex_training_job(
        project_id=args.project,
        region=args.region,
        bucket_name=args.bucket,
        dataset_uri=args.dataset,
        base_model=args.model,
        accelerator=args.accelerator,
        epochs=args.epochs,
        hf_token=args.hf_token,
    )
