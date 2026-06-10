# Trace Evidence Prototype

## Purpose

Trace is the first product from Stria Systems. It prototypes the operational record layer for enterprise AI: a middleware/data-plane path that captures agent actions, verifies identity, evaluates policy posture, and emits evidence records.

Core thesis:

> Before autonomous agents can act with authority, every action must be attributable, policy-evaluated, and permanently auditable.

## Principle

Evidence before enforcement.

The runtime defaults to observe mode. In observe mode, policy violations are recorded as evidence but do not block the action. Rules can opt into enforce mode when the organization is ready for hard interrupts.

## Machine-Readable Primitives

- `schemas/evidence.schema.json` defines the emitted evidence record contract.
- `examples/identity.yaml` defines the agent identity manifest for `accounts-payable-agent-17`.
- `examples/policy.yaml` defines policy posture, soft interrupts, and hard interrupts.

## Execution Path

1. Agent request enters Trace with prompt, model, tool, arguments, resources, and destination metadata.
2. Identity verification checks whether the agent is allowed to perform the requested tool capability.
3. Policy evaluation records rule outcomes across PII, token leakage, payment thresholds, vendor modification, production deletion, and network allowlist posture.
4. Evidence generation builds a structured record with ingress, action payload, evaluation ledger, and chain of custody.
5. Hashing uses deterministic canonical JSON and SHA-256.
6. Signing is currently a stub shaped as `signature_stub:v0:<record_hash>`.
7. JSON output returns both the agent-facing response and the emitted evidence record.

## Example Simulation

The sample agent attempts to create a payment draft for `$12,500`.

The `payment-threshold` rule triggers because the amount exceeds `$10,000`.

Observe mode result:

- `result: flag`
- `severity: high`
- `rule_mode: observe`
- `action_allowed: true`
- `reason: human supervisor signature required above threshold`

Enforce mode result:

- `result: block`
- `severity: high`
- `rule_mode: enforce`
- `action_allowed: false`
- standardized agent error returned
- evidence record still emitted

## Local Commands

```bash
npm run trace:simulate
npm test
```

## Current Non-Goals

- No full SaaS app.
- No UI.
- No production cryptographic signing.
- No external policy engine.
- No tenant provisioning.

The prototype is deliberately small so the data model and execution path can harden before product surface area expands.
