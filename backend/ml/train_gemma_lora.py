"""Standalone Native bfloat16 LoRA Fine-Tuning Script for Gemma 2 (9B / 2B) on Project RMAI.

Optimized for NVIDIA A100 (40GB/80GB) GPUs on Google Cloud Vertex AI.
Complies with the 5 Non-Negotiable Engineering Laws of RMA.
"""

import argparse
import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List

# Ensure PyTorch uses standard CUDA runtime, not XLA/PJRT CPU fallback
os.environ["CUDA_VISIBLE_DEVICES"] = "0"
os.environ["USE_TORCH_XLA"] = "0"
os.environ.pop("PJRT_DEVICE", None)


def load_dataset_records(dataset_path: str) -> List[Dict[str, Any]]:
    """Loads JSONL records from local disk or Google Cloud Storage (gs://)."""
    print(f"Loading training data from: {dataset_path}")
    records = []

    if dataset_path.startswith("gs://"):
        from google.cloud import storage

        parts = dataset_path[5:].split("/", 1)
        bucket_name, blob_name = parts[0], parts[1]
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        content = blob.download_as_text(encoding="utf-8")
        for line in content.splitlines():
            line = line.strip()
            if line:
                records.append(json.loads(line))
    else:
        with open(dataset_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))

    print(f"Loaded {len(records)} SFT training examples.")
    return records


def format_gemma_dialog(record: Dict[str, Any]) -> str:
    """Formats a message record into standard Gemma 2 turn tokens."""
    messages = record.get("messages", [])
    system_text = ""
    user_text = ""
    assistant_text = ""

    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "system":
            system_text = content
        elif role == "user":
            user_text = content
        elif role == "assistant":
            assistant_text = content

    combined_user = f"{system_text}\n\n{user_text}".strip() if system_text else user_text
    prompt = f"<start_of_turn>user\n{combined_user}<end_of_turn>\n<start_of_turn>model\n{assistant_text}<end_of_turn>"
    return prompt


def run_training(
    base_model_name: str,
    dataset_path: str,
    output_dir: str,
    epochs: int = 3,
    batch_size: int = 2,
    gradient_accumulation_steps: int = 8,
    learning_rate: float = 2e-4,
    lora_rank: int = 16,
    lora_alpha: int = 32,
    max_seq_length: int = 2048,
    hf_token: str | None = None,
):
    """Executes Native bfloat16 LoRA training using PyTorch, Transformers, and PEFT."""
    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, get_peft_model
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            DataCollatorForSeq2Seq,
            Trainer,
            TrainingArguments,
        )
    except Exception as e:
        print(f"❌ Failed to import training dependencies: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    if hf_token:
        os.environ["HF_TOKEN"] = hf_token

    print("================================================================")
    print("Project RMAI — Gemma 2 Native bfloat16 LoRA Engine (NVIDIA A100)")
    print(f"Base Model:       {base_model_name}")
    print(f"Dataset:          {dataset_path}")
    print(f"Output Dir:       {output_dir}")
    print(f"LoRA Config:      r={lora_rank}, alpha={lora_alpha}, lr={learning_rate}, epochs={epochs}")
    print(f"CUDA Available:   {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU Device:       {torch.cuda.get_device_name(0)}")
        print(f"GPU VRAM:         {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    print("================================================================")

    # 1. Load and format dataset
    raw_records = load_dataset_records(dataset_path)
    formatted_prompts = [format_gemma_dialog(r) for r in raw_records]

    # 2. Tokenizer
    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # Tokenize records
    def tokenize_function(texts):
        return tokenizer(texts, truncation=True, max_length=max_seq_length, padding=False)

    tokenized_dataset = Dataset.from_dict({"text": formatted_prompts})
    tokenized_dataset = tokenized_dataset.map(lambda x: tokenize_function(x["text"]), batched=True, remove_columns=["text"])
    tokenized_dataset = tokenized_dataset.map(lambda x: {"labels": x["input_ids"]})

    # 3. Base Model in native bfloat16
    print("Loading base model in native bfloat16 precision...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        trust_remote_code=True,
    )
    if torch.cuda.is_available():
        model = model.to(device)

    # Enable gradient checkpointing for minimal memory overhead
    if hasattr(model, "gradient_checkpointing_enable"):
        model.gradient_checkpointing_enable()

    # 4. LoRA Configuration
    lora_config = LoraConfig(
        r=lora_rank,
        lora_alpha=lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 5. Training Arguments
    local_output = "/tmp/model_output"
    os.makedirs(local_output, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=local_output,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        logging_steps=5,
        save_strategy="epoch",
        optim="adamw_torch",
        bf16=torch.cuda.is_bf16_supported(),
        fp16=not torch.cuda.is_bf16_supported(),
        max_grad_norm=0.3,
        gradient_checkpointing=True,
        dataloader_pin_memory=False,
        report_to="none",
    )

    # 6. Trainer
    trainer = Trainer(
        model=model,
        train_dataset=tokenized_dataset,
        args=training_args,
        data_collator=DataCollatorForSeq2Seq(tokenizer, pad_to_multiple_of=8, return_tensors="pt", padding=True),
    )

    print("Beginning training loop on NVIDIA A100 GPU...")
    trainer.train()

    print(f"Saving fine-tuned adapter to {local_output}...")
    trainer.model.save_pretrained(local_output)
    tokenizer.save_pretrained(local_output)

    # 7. Upload artifacts to GCS
    if output_dir.startswith("gs://"):
        print(f"Uploading artifacts to {output_dir}...")
        from google.cloud import storage

        parts = output_dir[5:].split("/", 1)
        bucket_name = parts[0]
        prefix = parts[1].rstrip("/") if len(parts) > 1 else ""
        client = storage.Client()
        bucket = client.bucket(bucket_name)

        uploaded_count = 0
        for root, _, files in os.walk(local_output):
            for file in files:
                local_path = os.path.join(root, file)
                rel_path = os.path.relpath(local_path, local_output)
                blob_name = f"{prefix}/{rel_path}" if prefix else rel_path
                blob = bucket.blob(blob_name)
                blob.upload_from_filename(local_path)
                print(f"Uploaded: {blob_name}")
                uploaded_count += 1

        print(f"✓ Uploaded {uploaded_count} model files to {output_dir}")

    print("================================================================")
    print("🎉 FINE-TUNING SUCCESSFULLY COMPLETED!")
    print("================================================================")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QLoRA/LoRA training for Gemma 2 on Project RMAI")
    parser.add_argument("--base-model", default="unsloth/gemma-2-9b-it", help="Hugging Face / GCS base model ID")
    parser.add_argument("--train-file", default="gs://rma-app-511110-ml-data/datasets/sft_train_500.jsonl", help="Training JSONL dataset")
    parser.add_argument("--output-dir", default="gs://rma-app-511110-ml-data/models/gemma2-9b-rmi-lora/", help="Output directory or GCS URI")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=2, help="Per-device batch size")
    parser.add_argument("--grad-accum", type=int, default=8, help="Gradient accumulation steps")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--lora-rank", type=int, default=16, help="LoRA rank r")
    parser.add_argument("--lora-alpha", type=int, default=32, help="LoRA alpha")
    parser.add_argument("--max-seq-len", type=int, default=2048, help="Max sequence length")
    parser.add_argument("--hf-token", default=os.environ.get("HF_TOKEN"), help="Hugging Face token for gated models")

    args = parser.parse_args()
    try:
        run_training(
            base_model_name=args.base_model,
            dataset_path=args.train_file,
            output_dir=args.output_dir,
            epochs=args.epochs,
            batch_size=args.batch_size,
            gradient_accumulation_steps=args.grad_accum,
            learning_rate=args.lr,
            lora_rank=args.lora_rank,
            lora_alpha=args.lora_alpha,
            max_seq_length=args.max_seq_len,
            hf_token=args.hf_token,
        )
    except Exception as exc:
        print(f"FATAL ERROR in run_training: {exc}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
