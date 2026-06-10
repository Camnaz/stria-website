# Trace MLX Training Loop

This directory holds the optional local model path for Trace. The playground itself stays deterministic and fast; this layer is for Apple Silicon experiments that help Trace learn enterprise usage patterns, security signals, and workflow routing.

## Why LoRA / QLoRA

Use `mlx-community/Qwen2.5-1.5B-Instruct-4bit` for the first pass. Because the model is quantized, MLX will use QLoRA and keep iteration lightweight while we build a better enterprise corpus.

## Install

```bash
python3 -m venv .venv-mlx
source .venv-mlx/bin/activate
pip install -r prototype/mlx-classifier/requirements.txt
```

## Seed classifier

```bash
python prototype/mlx-classifier/classify_usage.py "how to hack employee email password"
python prototype/mlx-classifier/classify_usage.py "payment audit policy for agent approvals"
```

## Build the corpus

The corpus builder can stay local-only for quick smoke tests, or hydrate public Hugging Face datasets for a much larger training set.

```bash
npm run trace:mlx:corpus -- --local-only
npm run trace:mlx:corpus -- --with-remote --limit 500
```

It writes:

- `datasets/trace-enterprise/train.jsonl`
- `datasets/trace-enterprise/valid.jsonl`
- `datasets/trace-enterprise/test.jsonl`
- `datasets/trace-enterprise/summary.json`

The current manifest mixes four sources:

- `datasets/usage-intelligence.jsonl` for Trace's curated seed labels
- `wambosec/prompt-injections` for generic prompt-injection detection
- `nandhak12/finguard-finance-injection-dataset` for finance-agent attack patterns
- `PolyAI/banking77` for enterprise support intent routing and escalation

## Train the adapter

MLX LoRA expects the data directory, not a single flat file, so point `--data` at the split directory.

```bash
npm run trace:mlx:train -- --local-only
```

For the isolated local training environment, prefer:

```bash
TRACE_PYTHON=.venv-mlx/bin/python npm run trace:mlx:train -- --local-only --iters 120 --adapter-path .trace/adapters/trace-enterprise-narrative-120
TRACE_PYTHON=.venv-mlx/bin/python npm run trace:mlx:classify -- "how to hack employee email password" --adapter-path .trace/adapters/trace-enterprise-narrative-120
```

That wrapper first builds the corpus, then launches MLX:

```bash
python3 -m mlx_lm lora \
  --model mlx-community/Qwen2.5-1.5B-Instruct-4bit \
  --train \
  --data datasets/trace-enterprise \
  --mask-prompt \
  --adapter-path .trace/adapters/trace-enterprise \
  --iters 600 \
  --batch-size 1 \
  --num-layers 4 \
  --grad-checkpoint
```

To smoke-test the flow without starting a long job, pass `--build-only` or `--dry-run` to the wrapper.

The wrapper also writes `baseline-predictions.jsonl` and `baseline-report.json` before training. Do not promote an adapter into the demo unless it beats the deterministic baseline on held-out examples and passes hand-authored smoke prompts for malicious, support/workflow, and routine usage.

Because the model is quantized, this behaves as QLoRA. If we later move to a non-quantized base model, the same command becomes plain LoRA.

## Evaluate

```bash
python3 -m mlx_lm lora \
  --model mlx-community/Qwen2.5-1.5B-Instruct-4bit \
  --adapter-path .trace/adapters/trace-enterprise \
  --data datasets/trace-enterprise \
  --test
```

## What this training is for

Trace should learn to do three things well:

- classify what kind of business or search usage just happened
- detect when prompts drift into unsafe, out-of-domain, or sensitive territory
- produce an operator-friendly narrative that explains why the event should be observed, flagged, or blocked

Keep enforcement deterministic in the runtime. The model should help with classification and triage, while Trace keeps the audit ledger authoritative.

## Operator-value training loop

Trace should not train just to train. Each iteration should make the operator view more useful:

1. Mine captured LLM usage for recurring company categories, such as finance operations, education integrity, developer troubleshooting, customer support, or security review.
2. Label events with `intent_classification`, `domain_alignment`, `risk_level`, `risk_signals`, `operator_narrative`, and `recommended_workflow`.
3. Generate LoRA examples that teach the model to explain why a usage pattern matters to a business operator.
4. Evaluate against held-out examples for category routing, unsafe intent detection, and narrative usefulness.
5. Promote an adapter only if it improves the measured operator outcome without weakening deterministic guardrails.

The useful product loop is:

```text
Trace event -> evidence label -> category pattern -> MLX adapter experiment -> eval -> guardrail or insight candidate
```

This mirrors the lightweight autonomous-experiment pattern: keep the loop local, fast, auditable, and metric-driven.
