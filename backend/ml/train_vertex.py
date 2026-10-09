"""Vertex AI Fine-Tuning Orchestrator for Google Gemma 2 on Project RMAI.

Submits Custom Fine-Tuning Jobs to Vertex AI (Project: rma-app-511110)
utilizing QLoRA parameter-efficient tuning on Gemma base models.
Supports fastest GPU accelerators (NVIDIA A100 80GB, L4, etc.).
"""

import argparse
import json
from pathlib import Path
from ml.submit_vertex_custom_job import ACCELERATOR_CONFIGS, submit_vertex_training_job


def submit_tuning_job(
    project_id: str = "rma-app-511110",
    region: str = "us-central1",
    bucket_name: str = "rma-app-511110-ml-data",
    dataset_gcs_uri: str = "gs://rma-app-511110-ml-data/datasets/sft_train_500.jsonl",
    output_gcs_uri: str = "gs://rma-app-511110-ml-data/models/gemma2-9b-rmi-lora/",
    base_model: str = "google/gemma-2-9b-it",
    accelerator: str = "a100-80gb",
    epochs: int = 3,
    learning_rate: float = 2e-4,
    lora_rank: int = 16,
    lora_alpha: int = 32,
    submit_now: bool = False,
    hf_token: str | None = None,
):
    """Generates the Vertex AI Training Job spec and optionally submits the job."""
    acc_spec = ACCELERATOR_CONFIGS.get(accelerator.lower(), ACCELERATOR_CONFIGS["a100-80gb"])

    print("================================================================")
    print("Project RMAI — Google Cloud Vertex AI Fine-Tuning Orchestrator")
    print("================================================================")
    print(f"Project ID:       {project_id}")
    print(f"Region:           {region}")
    print(f"Base Model:       {base_model}")
    print(f"Accelerator Tier: {accelerator.upper()} ({acc_spec['machine_type']}, {acc_spec['accelerator_type']})")
    print(f"Training Dataset: {dataset_gcs_uri}")
    print(f"Output Artifacts: {output_gcs_uri}")
    print(f"LoRA Config:      r={lora_rank}, alpha={lora_alpha}, lr={learning_rate}, epochs={epochs}")
    print("----------------------------------------------------------------")

    config = {
        "display_name": f"rma-gemma-2-9b-{accelerator.lower()}-{base_model.replace('/', '-')}",
        "project": project_id,
        "location": region,
        "base_model": base_model,
        "training_dataset_uri": dataset_gcs_uri,
        "output_dir": output_gcs_uri,
        "compute": {
            "machine_type": acc_spec["machine_type"],
            "accelerator_type": acc_spec["accelerator_type"],
            "accelerator_count": acc_spec["accelerator_count"],
        },
        "hyperparameters": {
            "epoch_count": epochs,
            "learning_rate": learning_rate,
            "lora_rank": lora_rank,
            "lora_alpha": lora_alpha,
            "lora_dropout": 0.05,
            "target_modules": [
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
                "gate_proj",
                "up_proj",
                "down_proj",
            ],
            "optimizer": "paged_adamw_8bit",
            "max_seq_length": 4096,
        },
    }

    spec_path = Path("artifacts/vertex_tuning_job_spec.json")
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    with open(spec_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"✓ Tuning Job Specification written to {spec_path}")

    if submit_now:
        print("\n▶ Launching job on Vertex AI now...")
        submit_vertex_training_job(
            project_id=project_id,
            region=region,
            bucket_name=bucket_name,
            dataset_uri=dataset_gcs_uri,
            output_uri=output_gcs_uri,
            base_model=base_model,
            accelerator=accelerator,
            epochs=epochs,
            hf_token=hf_token,
        )
    else:
        print("✓ To submit to Vertex AI:")
        print(f"  uv run python -m ml.train_vertex --project {project_id} --accelerator {accelerator} --submit")

    return config


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Submit Gemma fine-tuning job to Vertex AI")
    parser.add_argument("--project", default="rma-app-511110", help="GCP Project ID")
    parser.add_argument("--region", default="us-central1", help="Vertex AI Region")
    parser.add_argument("--model", default="google/gemma-2-9b-it", help="Base Model")
    parser.add_argument("--dataset", default="gs://rma-app-511110-ml-data/datasets/sft_train_500.jsonl", help="GCS Dataset URI")
    parser.add_argument("--accelerator", default="a100-80gb", choices=["a100-80gb", "a100", "a100-40gb", "l4", "t4"], help="Accelerator tier")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--hf-token", default=None, help="Hugging Face token for gated models")
    parser.add_argument("--submit", action="store_true", help="Submit job to Vertex AI immediately")
    args = parser.parse_args()

    submit_tuning_job(
        project_id=args.project,
        region=args.region,
        base_model=args.model,
        dataset_gcs_uri=args.dataset,
        accelerator=args.accelerator,
        epochs=args.epochs,
        submit_now=args.submit,
        hf_token=args.hf_token,
    )
