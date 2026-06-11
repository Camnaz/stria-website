# Trace Autonomous Testing Engine - Implementation Complete

## Overview
Built a self-improving, autonomous testing engine for Trace that continuously learns from real user interactions via a dual-loop architecture:

1. **Action & Telemetry Loop (Real-Time)**: Captures user inputs, LLM outputs, and latency metrics from Trace
2. **Evaluation & Optimization Loop (Scheduled)**: Hermes analyzes data, flags insights, generates synthetic test cases, triggers retraining

---

## Architecture Components

### 1. MLX Local Server (Port 8085)
```
Model: mlx-community/Qwen2.5-1.5B-Instruct-4bit
Adapter: .trace/adapters/trace-enterprise-full-600 (8 layers, 2.6M params)
Endpoints: /v1/chat/completions, /v1/models, /health
```

### 2. Trace Telemetry API (Port 3000)
```
Mock server for development
Endpoints: GET /api/v1/telemetry/recent?minutes=60
GET /api/v1/health
```

### 3. Evaluation Flywheel Script
```
Location: scripts/evaluate_trace.py
Run: Hourly via cron (minute 5)
```

---

## Data Flow

```
[User Interactions] 
    → [Trace Data Plane: Input/Output/Latency] 
    → [Local Log: trace_telemetry.jsonl]
    → [Eval Flywheel (cron hourly)]
        → [Fetch last 60min telemetry]
        → [Compute local metrics: p50/p95/p99 latency, error rate, token usage]
        → [Alert if p95 > 2s or error_rate > 5%]
        → [Send to Hermes MLX for deep analysis]
        → [Append learning record: continuous_learning_dataset.jsonl]
        → [Extract insights: insights_log.jsonl]
        → [Check retrain threshold (500 high-quality samples)]
            → [Trigger MLX LoRA retrain]
            → [Hot-swap adapter in MLX server]
```

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/start_mlx_server.sh` | Start MLX server with Trace adapter |
| `scripts/start_autonomous_engine.sh` | Start all components + install cron |
| `scripts/stop_autonomous_engine.sh` | Stop all components |
| `scripts/install_cron.sh` | Install hourly/daily/weekly cron jobs |
| `scripts/evaluate_trace.py` | Main flywheel evaluation script |
| `scripts/trace_telemetry_api.py` | Mock telemetry API server |
| `scripts/com.striasystems.trace.mlx-server.plist` | launchd service for MLX server |
| `.trace/adapters/trace-enterprise-full-600/` | Trained LoRA adapter (600 iters, 8 layers) |
| `datasets/trace-enterprise-full/` | Training data (2,109 examples) |
| `continuous_learning_dataset.jsonl` | Accumulated learning records |
| `insights_log.jsonl` | Extracted insights for querying |
| `metrics_log.jsonl` | Hourly metrics snapshots |

---

## Cron Jobs Installed

| Schedule | Job | Output |
|----------|-----|--------|
| `* * * * *` | MLX health check (restart if down) | `logs/mlx_server.log` |
| `5 * * * *` | Evaluation flywheel | `logs/eval_flywheel.log` |
| `0 2 * * *` | Daily metrics rollup | `logs/daily_rollup.log` |
| `0 3 * * 0` | Weekly retrain check (500 samples) | `logs/weekly_retrain.log` |

---

## Current Status

### Trained Adapter Performance (600 iterations, local-only 2,109 examples)
| Metric | Score |
|--------|-------|
| Train Loss | 0.015 |
| Val Loss | 0.008 |
| Intent Accuracy (probe) | 91.7% |
| Domain Accuracy (probe) | 83.9% |
| High-Risk Recall | 55.6% (needs remote data) |

### Flywheel Metrics (4 evaluation cycles)
- Events analyzed: 24 per cycle
- p95 Latency: 4,337ms (alert threshold: 2,000ms) ✓ Alerting works
- Error Rate: 0% 
- Learning records accumulated: 4
- High-quality synthetic test cases: pending valid Hermes JSON output

---

## Known Issues & Next Steps

### 1. Hermes JSON Output Reliability
**Issue**: Qwen2.5-1.5B model inconsistently outputs valid JSON
**Fix Options**:
- Use larger model (Qwen2.5-7B or Nemotron-3-Ultra via API)
- Add JSON repair/extraction logic in `analyze_with_hermes()`
- Use OpenAI-compatible structured output (if supported)

### 2. Remote Data Hydration Failed
**Issue**: HF datasets (wambosec, JailbreakDB, FinGuard, Banking77) failed with `RLock` error
**Fix**: Run corpus build with `--with-remote` in single-threaded mode or set `HF_HUB_DISABLE_SYMLINKS_WARNING=1`

### 3. MLX Server Process Management
**Current**: Background processes via terminal
**Production**: Use launchd plist (`com.striasystems.trace.mlx-server.plist`) or systemd

### 4. Telemetry API Auth
**Issue**: Mock server returns 401
**Fix**: Either disable auth in mock or add API key to eval script

---

## Quick Start Commands

```bash
# Start full engine
cd "/Users/cnazarko/stria systems/TraceV2"
bash scripts/start_autonomous_engine.sh

# Stop engine
bash scripts/stop_autonomous_engine.sh

# Install cron jobs only
bash scripts/install_cron.sh

# Manual evaluation run
MLX_SERVER_URL=http://localhost:8085/v1/chat/completions \
MLX_MODEL=mlx-community/Qwen2.5-1.5B-Instruct-4bit \
.venv-mlx/bin/python scripts/evaluate_trace.py

# Check learning progress
cat continuous_learning_dataset.jsonl | wc -l
tail -f logs/eval_flywheel.log

# View accumulated insights
cat insights_log.jsonl | jq .

# View daily rollup
cat logs/daily_rollup.log
```

---

## Production Deployment Checklist

- [ ] Fix remote data hydration for full 6,000+ example dataset
- [ ] Upgrade to larger model (Qwen2.5-7B or Nemotron) for reliable JSON
- [ ] Implement launchd service for MLX server auto-restart
- [ ] Integrate real Trace telemetry API (replace mock)
- [ ] Add PII scrubbing before logging to learning dataset
- [ ] Set up alerting (Slack/PagerDuty) for latency/error thresholds
- [ ] Add model versioning and rollback capability
- [ ] Implement A/B testing for new adapter versions
- [ ] Add cost tracking (token usage × model pricing)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRACE AUTONOMOUS ENGINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐   │
│  │ User         │───▶│ Trace Data      │───▶│ trace_        │   │
│  │ Interactions │    │ Plane (API)     │    │ telemetry.jsonl│   │
│  └──────────────┘    └─────────────────┘    └──────┬────────┘   │
│                                                     │            │
│                            ┌────────────────────────▼────────┐  │
│                            │     CRON (hourly :05)           │  │
│                            │  scripts/evaluate_trace.py      │  │
│                            │  - Fetch 60min telemetry        │  │
│                            │  - Compute metrics              │  │
│                            │  - Alert on anomalies           │  │
│                            │  - Query Hermes MLX             │  │
│                            └────────────┬────────────────────┘  │
│                                         │                       │
│                    ┌────────────────────┼────────────────────┐  │
│                    ▼                    ▼                    ▼  │
│            ┌──────────────┐    ┌──────────────────┐    ┌──────┐│
│            │ continuous_  │    │ insights_        │    │metr- ││
│            │ learning_    │    │ log.jsonl        │    │ics_  ││
│            │ dataset.jsonl│    │ (queryable)      │    │log.  ││
│            └──────────────┘    └──────────────────┘    └──────┘│
│                    │                                        │    │
│                    ▼                                        ▼    │
│            ┌──────────────┐                          ┌──────────┐│
│            │ Threshold    │                          │ Daily    ││
│            │ Check(500)   │                          │ Rollup   ││
│            └──────┬───────┘                          └──────────┘│
│                   │                                          │    │
│                   ▼                                          ▼    │
│            ┌──────────────┐                          ┌──────────┐│
│            │ Trigger      │                          │ Weekly   ││
│            │ MLX LoRA     │                          │ Retrain  ││
│            │ Retrain      │                          │ Check    ││
│            └──────┬───────┘                          └──────────┘│
│                   │                                          │    │
│                   ▼                                          ▼    │
│            ┌──────────────┐                          (noop if   │
│            │ Hot-swap     │                           threshold │
│            │ Adapter in   │                            not met)  │
│            │ MLX Server   │                                     │
│            └──────────────┘                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Generated: 2026-06-11*
*Engine Status: RUNNING (MLX:8085, Telemetry:3000, Cron:INSTALLED)*