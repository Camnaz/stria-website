# Trace Demo And Ingestion Plan

## Goal

Trace should be demonstrable before it is a full product UI. The first credible demo is a local data-plane run that proves an AI usage event can be attributed, policy-evaluated, recorded, hashed, replayed, and explained with an operator-facing summary.

## Current Local Demo

Run:

```bash
npm run trace:simulate
```

The simulation loads:

- `examples/identity.yaml`
- `examples/policy.yaml`
- `schemas/evidence.schema.json`

Then it runs a payment draft action for `$12,500`.

Expected behavior:

- observe mode flags `payment-threshold`
- observe mode allows the action
- enforce mode blocks the same action
- both modes emit evidence records
- sensitive arguments are redacted in preview
- full arguments are represented by SHA-256 hash
- evidence records have deterministic record hashes

## Developer Quickstart

Clone and start the local data-plane service:

```bash
git clone <repository-url>
cd TraceV2
npm run trace:install
```

The bootstrap installs dependencies if needed and starts the service on `http://localhost:8787`.

Open the local browser demo:

```text
http://localhost:8787/
```

Manual start remains available:

```bash
npm run trace:serve
```

Smoke checks:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/trace/fixtures
```

Run observe mode:

```bash
curl -X POST "http://localhost:8787/trace/fixtures/payment-draft-above-threshold/run?mode=observe"
```

Run enforce mode:

```bash
curl -X POST "http://localhost:8787/trace/fixtures/payment-draft-above-threshold/run?mode=enforce"
```

Post a custom event:

```bash
curl -X POST "http://localhost:8787/trace/evaluate?mode=observe" \
  -H "content-type: application/json" \
  --data @fixtures/events/payment-draft-above-threshold.json
```

## What Developer Consumers Should See

A strong early developer demo should show the same event in three layers:

1. **Agent-facing response**: allowed or blocked, with a standardized error when blocked.
2. **Evaluation ledger**: each rule, mode, result, reason, and severity.
3. **Evidence record**: ingress envelope, action payload, custody metadata, hash, and signing stub.

The demo should make the product thesis obvious:

> Evidence before enforcement.

Trace should not look like a generic dashboard at this stage. It should look like a trustworthy record layer that can sit beside existing AI systems.

## Ingestion Contract

To test Trace against realistic workflows, every agent event should provide:

- `request_id`
- `agent_id`
- organization id
- environment
- prompt or prompt hash
- generated response or response hash
- model provider
- model name
- model config or config hash
- parent context hash
- tool namespace
- tool name
- action
- arguments
- resources targeted
- resources modified
- network destination
- received timestamp
- response preview, finish reason, token usage, and response timestamp when available

Identity manifests provide:

- agent UUID
- identity version
- human owner/operator
- service account mappings
- allowed tool capabilities
- denied tool capabilities
- allowed network destinations
- allowed resource scopes

Policy manifests provide:

- global mode
- rule-specific modes
- detector configuration
- thresholds
- soft interrupts
- hard interrupts
- allowlists
- forbidden tool/resource rules

## Near-Term Test Harness

The next harness should add fixture-driven runs:

```text
fixtures/events/*.json
fixtures/expected/*.json
```

Each fixture should represent one realistic event:

- payment draft above threshold
- payment draft below threshold
- vendor modification attempt
- token leakage attempt
- network destination outside allowlist
- production database deletion attempt

The test runner should load each event, emit evidence, validate against schema, and compare the important ledger fields.

## Served Demo Path

The first served demo is local-only and still avoids becoming a SaaS app. It should prove the product loop:

```text
frontend capture -> backend ingest -> local event store -> session replay -> analytics snapshot
```

- a small browser page for simulating managed AI-search usage
- a local ingestion endpoint that accepts tenant/project/user/session metadata plus an agent event
- a local SQLite database that keeps events under the correct business ownership keys
- replay by session with previous-record hash chaining
- analytics over stored events by tenant, project, user, intent, risk, response counts, and token usage
- session summaries with improvement opportunities for operators
- fixture endpoints for deterministic engineering checks
- JSON response with `agent_response` and `evidence_record`
- read-only evidence, replay, and analytics panels

Current endpoints:

```text
GET /health
GET /trace/fixtures
GET /trace/events
GET /trace/replay/:session_id
GET /trace/analytics
POST /trace/evaluate
POST /trace/ingest
POST /trace/fixtures/:fixture_id/run
```

`POST /trace/evaluate` is the low-level evidence path. `POST /trace/ingest` is the product path: it records who generated the event, where it belongs, how it chains inside a session, what response was generated, and what the operator dashboard should summarize.

## Enterprise Install Direction

Trace is being built agentic-first. The data-plane runtime should be easy to place wherever agents already execute:

- developer laptop for local testing
- CI runner for automated fixture checks
- enterprise-managed workstation or server
- customer VPC service
- containerized sidecar beside agent workflows
- future endpoint-management or package-manager distribution

The current `npm run trace:install` path is a prototype bootstrap, not the final enterprise installer. It defines the desired behavior: install locally, start automatically, expose health and evaluation endpoints, and let teams test policy/evidence behavior without standing up a full SaaS surface.

The website can link to this once the served runtime exists, but the current prototype should keep the product demo honest: no production SaaS claims, no hidden collection, and no opaque surveillance language. Customer demos should describe transparent, enterprise-managed AI usage governance.

## Data Sources To Test Against

Good synthetic and customer-safe test data should include:

- accounts payable payment drafts
- support agent knowledge lookups
- sales operations CRM updates
- research summarization workflows
- internal finance memo generation
- controlled security policy violations

Avoid ingesting raw customer secrets or production PII in early demos. Use realistic structure with synthetic values, then prove redaction and hashing behavior.

## Local LoRA / MLX Adapter Plan

The deterministic classifier should remain the source of truth for early tests. A local adapter can assist with language-heavy work once we have enough labeled examples.

Initial adapter tasks:

- classify usage intent from prompt, surface, tool, and response metadata
- route events into review queues such as security, compliance, education integrity, or workflow optimization
- summarize a session replay into an operator narrative
- suggest policy-pack changes from repeated usage patterns

Starter local path:

- Use `datasets/usage-intelligence.jsonl` as the seed evaluation/training set.
- Use `npm run trace:mlx:prepare` to generate `datasets/usage-intelligence-lora.jsonl`.
- Use `npm run trace:mlx:evaluate` as the adapter-evaluation harness.
- Use `prototype/mlx-classifier/classify_usage.py` for local inference experiments.
- Start with `mlx-community/Qwen2.5-1.5B-Instruct-4bit` for Apple Silicon iteration.
- Keep enforcement decisions deterministic; model output should inform classification and summaries, not silently block users.

Operator-value loop:

1. Capture raw managed LLM usage as evidence.
2. Label the event with business category, workflow intent, risk posture, domain alignment, and operator recommendation.
3. Aggregate repeated labels into company/category patterns.
4. Train a small local MLX LoRA or QLoRA adapter to improve classification, routing, and operator narratives.
5. Evaluate on held-out events before promoting an adapter or suggesting a policy-pack change.
6. Preserve deterministic enforcement while using the model to propose better guardrails and insights.

This borrows from autonomous research loops like Karpathy's `autoresearch`: keep the task small, run fast experiments, measure improvement, and only retain changes that improve the target metric.

## Open Build Items

- Durable persistence beyond the local SQLite prototype database.
- Richer response capture for multi-turn model outputs, streamed chunks, and tool-call deltas.
- Policy pack versioning.
- Identity manifest validation.
- Signing implementation beyond stub.
- Larger labeled dataset for the local adapter training recipe.
- Better operator dashboard filters for tenant, project, user, session, intent, risk, and time range.
