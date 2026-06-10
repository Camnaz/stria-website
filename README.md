# Stria Systems / Trace

This workspace houses the public website for Stria Systems and an initial local prototype for Trace.

Stria Systems builds accountability infrastructure for autonomous systems. Trace is the first product: evidence infrastructure and operational intelligence for AI agents.

Trace's core thesis:

> Before autonomous agents can act with authority, every action must be attributable, policy-evaluated, and permanently auditable.

## Public Surfaces

- `/` - Stria Systems company website
- `/trace` - Trace product website
- `/architecture` - Stria and Trace architecture overview
- `/trace/documentation` - Trace developer documentation
- `/docs` - Alias to Trace developer documentation
- `/demo` - Request demo surface

## Website Development

```bash
npm install
npm run dev
```

## Local Trace Prototype

The local prototype is intentionally not a SaaS app. It includes a lightweight playground plus the data model and execution path for the Trace evidence/data plane:

Agent Request -> Identity Verification -> Policy Evaluation -> Evidence Record Generation -> Hashing / Signing Stub -> JSON Output

The core design principle is evidence before enforcement. The policy defaults to observe mode, so violations are recorded but not blocked unless a rule is configured for enforcement.

### Machine-Readable Primitives

- `schemas/evidence.schema.json` - JSON Schema for emitted Trace evidence records.
- `examples/identity.yaml` - Example identity manifest for `accounts-payable-agent-17`.
- `examples/policy.yaml` - Example policy posture with observe and enforce rules.
- `examples/business-constraints.yaml` - Natural-language business constraints for managed AI usage review.

The example agent can read invoices and create payment drafts. It cannot approve payments or modify vendors.

### Run the Simulation

```bash
npm run trace:simulate
```

The simulation emits JSON for two flows:

1. Observe mode: the agent attempts to create a `$12,500` payment draft. The `payment-threshold` rule flags the action because it exceeds `$10,000`, but the action is allowed and evidence is emitted.
2. Enforce mode: the same rule is switched to enforce mode. The action is blocked, a standardized error is returned to the agent, and evidence is still emitted.

Example excerpt:

```json
{
  "rule_id": "payment-threshold",
  "rule_mode": "observe",
  "result": "flag",
  "severity": "high",
  "reason": "human supervisor signature required above threshold"
}
```

The runtime uses SHA-256 for local hashes, deterministic canonical JSON for record hashing, redacted argument previews, and a signing stub shaped as `signature_stub:v0:<record_hash>`.

### Run the Local Demo Service

Agentic-first local bootstrap:

```bash
npm run trace:install
```

This installs dependencies if needed and starts the local Trace data-plane service.

Manual start:

```bash
npm run trace:serve
```

The local service starts on `http://localhost:8787`.
Ingested events are persisted to a local SQLite database at `.trace/trace-local.sqlite` unless `TRACE_DB_PATH` is set.

Open the managed AI usage playground:

```text
http://localhost:8787/
```

Useful endpoints:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/trace/fixtures
curl http://localhost:8787/trace/events
curl http://localhost:8787/trace/analytics
curl http://localhost:8787/trace/replay/sess_google_ai_search_demo
curl -X POST "http://localhost:8787/trace/fixtures/payment-draft-above-threshold/run?mode=observe"
curl -X POST "http://localhost:8787/trace/fixtures/payment-draft-above-threshold/run?mode=enforce"
curl -X POST "http://localhost:8787/trace/fixtures/vendor-modification-denied/run?mode=observe"
```

The playground simulates a transparent managed Google / AI-search session. Type a query and press Enter to see Trace classify:

- LLM-adjacent usage detection
- intent classification
- business-domain alignment
- risk level and risk signals
- model response preview and response hash
- operator narrative
- recommended workflow
- tenant/project/user/session storage
- session replay and analytics snapshot
- improvement opportunities for operators
- schema-valid evidence JSON

To test custom data, post an agent event JSON payload to:

```bash
curl -X POST "http://localhost:8787/trace/evaluate?mode=observe" \
  -H "content-type: application/json" \
  --data @fixtures/events/payment-draft-above-threshold.json
```

To test the product ingestion path, wrap an agent event in tenant ownership metadata:

```bash
curl -X POST "http://localhost:8787/trace/ingest?mode=observe" \
  -H "content-type: application/json" \
  --data '{
    "tenant_id": "tenant_acme",
    "project_id": "proj_ai_governance",
    "user_id": "user_001",
    "session_id": "sess_browser_001",
    "source": "api",
    "tags": ["demo"],
    "call": {
      "request_id": "demo_search_001",
      "agent_id": "accounts-payable-agent-17",
      "prompt": "Search Google for: enterprise AI evidence records",
      "model_provider": "local-playground",
      "model_name": "operator-input",
      "model_config": { "source": "curl" },
      "parent_context": { "page": "trace-local-playground" },
      "tool_namespace": "browser.web",
      "tool_name": "google.search",
      "action": "search",
      "arguments": {
        "query": "enterprise AI evidence records",
        "destination_url": "https://www.google.com/search?q=enterprise%20AI%20evidence%20records",
        "llm_usage_detected": true,
        "llm_surface": "google_search_with_gemini_available",
        "intent_classification": "business_sensitive_workflow",
        "domain_alignment": "in_domain",
        "risk_level": "low",
        "risk_signals": [],
        "operator_narrative": "Business AI governance search.",
        "recommended_workflow": "Record baseline usage and continue observing."
      },
      "resources_targeted": ["web_search:google"],
      "resources_modified": [],
      "network_destination": "www.google.com",
      "received_timestamp": "2026-06-06T21:00:00.000Z"
    }
  }'
```

### Test the Prototype

```bash
npm test
```

Tests cover:

- evidence schema validation
- observe-mode flag behavior
- enforce-mode block behavior
- identity capability denial
- deterministic record hashing
- managed AI-search intent and risk classification
- tenant/project/user/session ingestion
- session replay with previous-record hash chaining
- analytics aggregation over stored usage events
- response capture, response hashing, and session summaries

### Optional Local MLX Classifier

The runtime uses deterministic rules by default so the demo stays fast. For Apple Silicon model-assisted classification experiments:

```bash
python3 -m venv .venv-mlx
source .venv-mlx/bin/activate
pip install -r prototype/mlx-classifier/requirements.txt
npm run trace:mlx:classify -- "how to hack employee email password"
npm run trace:mlx:prepare
npm run trace:mlx:evaluate
npm run trace:mlx:corpus -- --local-only
npm run trace:mlx:train -- --local-only
```

Use the dedicated venv explicitly when training from npm:

```bash
TRACE_PYTHON=.venv-mlx/bin/python npm run trace:mlx:train -- --local-only --iters 120 --adapter-path .trace/adapters/trace-enterprise-narrative-120
TRACE_PYTHON=.venv-mlx/bin/python npm run trace:mlx:classify -- "how to hack employee email password" --adapter-path .trace/adapters/trace-enterprise-narrative-120
```

The starter dataset is `datasets/usage-intelligence.jsonl`. `npm run trace:mlx:prepare` creates chat-format LoRA examples in `datasets/usage-intelligence-lora.jsonl`. The aggressive local corpus builder expands the seed set into `datasets/trace-enterprise*/` with synthetic enterprise workflows, held-out splits, baseline predictions, and `baseline-report.json`. The suggested first local model is `mlx-community/Qwen2.5-1.5B-Instruct-4bit`.
For a more realistic training loop, `npm run trace:mlx:corpus -- --with-remote` builds `datasets/trace-enterprise/` from Trace's local labels plus public enterprise-security and support corpora. `npm run trace:mlx:train -- --with-remote` then builds the corpus and starts MLX in one pass.

Trace's intended learning loop is deliberately small and measurable:

1. Capture LLM usage with tenant, user, session, prompt, response preview, policy result, and evidence hash.
2. Convert the event into labels: company category, workflow intent, risk level, domain alignment, and recommended operator action.
3. Add the labeled event to the local enterprise corpus.
4. Run a short MLX LoRA/QLoRA experiment.
5. Evaluate whether classification, triage, or operator narrative quality improved.
6. Keep the adapter or policy-pack change only when it improves the measured operator outcome.

This follows the same spirit as small autonomous research loops: fast experiments, fixed evaluation targets, and no silent promotion of unmeasured changes. Enforcement remains deterministic; local models help Trace discover patterns, draft insights, and propose category-specific guardrails.

### Demo And Ingestion Planning

- `docs/architecture/trace-evidence-prototype.md` explains the current evidence runtime.
- `docs/architecture/trace-demo-and-ingestion.md` explains how Trace should be tested locally, how demos should be served to customers, and what event data Trace needs to ingest.
