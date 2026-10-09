"""Ollama Export & Modelfile Packaging for Google Gemma 4 e4b on Project RMAI.

Generates the custom Ollama Modelfile with optimized inference parameters,
stop tokens, and system instructions for Project RMAI.
"""

import argparse
from pathlib import Path


def create_modelfile(
    base_model: str = "gemma4:e4b",
    adapter_path: str | None = None,
    output_dir: str = "artifacts",
) -> Path:
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    modelfile_path = out_dir / "Modelfile"

    lines = [f"FROM {base_model}"]

    if adapter_path:
        lines.append(f"ADAPTER {adapter_path}")

    lines.extend([
        "",
        "# Inference Parameters for Deterministic Risk Analysis",
        "PARAMETER temperature 0.1",
        "PARAMETER top_p 0.9",
        "PARAMETER top_k 40",
        "PARAMETER repeat_penalty 1.15",
        "PARAMETER num_ctx 4096",
        "",
        "# Custom Stop Tokens to Prevent Hallucination Run-on",
        'PARAMETER stop "<end_of_turn>"',
        'PARAMETER stop "<<<DOCUMENT-"',
        'PARAMETER stop "```"',
        "",
        "# Prompt Template for Gemma Instruction Format",
        'TEMPLATE """{{ if .System }}<start_of_turn>system',
        "{{ .System }}<end_of_turn>",
        "{{ end }}{{ if .Prompt }}<start_of_turn>user",
        "{{ .Prompt }}<end_of_turn>",
        "<start_of_turn>model",
        '{{ end }}"""',
    ])

    content = "\n".join(lines) + "\n"
    with open(modelfile_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("================================================================")
    print("Project RMAI — Ollama Modelfile Packaging")
    print("================================================================")
    print(f"Modelfile generated at: {modelfile_path}")
    print("\nTo build and register the model in local Ollama:")
    print(f"  cd {out_dir} && ollama create gemma4:e4b-rmi -f Modelfile")
    print("\nTo test the model in RMI:")
    print("  Set OLLAMA_MODEL=gemma4:e4b-rmi in backend/.env")
    print("  uv run python -m scripts.model_check --runs 1")
    print("================================================================")

    return modelfile_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Ollama Modelfile for RMI Gemma 4 e4b")
    parser.add_argument("--base", default="gemma4:e4b", help="Base Ollama model tag")
    parser.add_argument("--adapter", default=None, help="Path to LoRA GGUF adapter")
    parser.add_argument("--output-dir", default="artifacts", help="Output directory")
    args = parser.parse_args()

    create_modelfile(base_model=args.base, adapter_path=args.adapter, output_dir=args.output_dir)
