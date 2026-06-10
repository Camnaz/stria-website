# Trace Training Roadmap

Trace's model should assist the operator and backend loop engines. It should not become the authority for enforcement.

## Current Local Model

- Base model: `mlx-community/Qwen2.5-1.5B-Instruct-4bit`
- Best current adapter: `.trace/adapters/trace-enterprise-planes-220`
- Latest insider-risk adapter: `.trace/adapters/trace-enterprise-insider-160`
- Training examples: `524`
- Probe result: `90%` intent accuracy, `90%` risk accuracy on the operational probe set
- Use: local operator narrative, usage classification assistance, prompt triage, and control suggestions
- Do not use as: final policy authority, legal determination, or blocking engine

The insider-risk adapter was trained on `617` local examples and correctly catches the explicit sabotage probes, but its probe result is `91.7%` intent accuracy and `83.3%` risk accuracy because it over-escalates some defensive governance prompts. Keep `.trace/adapters/trace-enterprise-planes-220` as the promoted local adapter until the insider-risk adapter improves risk calibration.

## Current Finding

The adapter improves when trained on Trace-native examples:

- Data Plane policy violations
- Control Plane policy and identity workflows
- Trust Plane evidence hashes and Merkle verification
- stakeholder-specific questions from CISO, general counsel, compliance, AI platform, and operations
- malicious and defensive security prompts

The local adapter is still unstable on risk calibration. Deterministic policy and evidence engines must override model output.

The latest regression case is plain-language insider intent: `ways I can sabotage my company`. Trace must not treat this as general research. It should classify the prompt as high-risk, preserve evidence, suppress harmful operational guidance, and route it to review while leaving enforcement configurable.

## Conversation Intelligence Loop

Trace should learn from managed enterprise LLM usage without becoming hidden surveillance or an unrestricted monitoring tool. The product path is:

1. Capture the managed LLM interaction: prompt, model response, model/provider, user or service identity, session, department, surface, and policy context.
2. Deconstruct the interaction: identify intent, business domain, sensitive data, adverse intent, policy posture, and useful operator narrative.
3. Emit evidence: retain attributable records, deterministic hashes, redacted previews, and review state.
4. Convert to operator value: group repeated patterns into business insights, workflow bottlenecks, guardrail candidates, and training examples.
5. Improve safely: replay held-out evals, measure high-risk recall, and promote adapters only when they improve classification without weakening deterministic controls.

The model should infer latent intent from both the user prompt and the LLM response. For example, a response that explains how to manipulate approvals, delete logs, expose credentials, or damage an organization should become training signal even when the original prompt was vague.

## Insider-Risk Training Target

Trace now treats adverse insider wording as a first-class risk category:

- sabotage or retaliation intent
- leaking confidential company data
- disrupting company operations
- destroying company data
- manipulating vendor or payment workflows
- hiding activity by deleting logs or audit evidence

The model response path must refuse operational harm instructions. The Trace output should still be useful to operators: parsed text, why the text was parsed, risk posture, owner, evidence path, and a suggested review workflow.

## Plane Responsibilities

### Data Plane

Runs inside the customer environment. Captures agent/tool actions, evaluates identity and policy, emits evidence, and optionally blocks actions.

Model role: summarize action intent, identify sensitive terms, suggest review context.

Backend authority: identity verification, policy result, evidence hash, enforcement mode.

### Control Plane

Manages identities, policies, environments, review workflows, evidence search, and integrations.

Model role: help operators query evidence, explain policy posture, summarize review bottlenecks.

Backend authority: policy versioning, workflow state, access control, audit search.

### Trust Plane

Aggregates evidence hashes, creates Merkle roots, and supports tamper-evident audit verification.

Model role: explain the audit path and help humans understand what changed.

Backend authority: canonical JSON, hashing, signatures, Merkle roots, custody chain.

## Nemotron 3 Path

Nemotron 3 is a better target for agentic reasoning and tool-use behavior than the current local Qwen adapter, but official Nemotron training recipes require supported multi-node GPU environments. The local machine should prepare:

- chat JSONL examples
- policy eval sets
- red-team attack cases
- role-specific operator tasks
- tool-call/action traces
- deterministic expected outputs

Remote training should use PEFT/SFT first, then RL or reward modeling only after deterministic evals are stable.

## TurboQuant / TurboVec Path

TurboVec is a Rust vector index built around Google Research's TurboQuant idea. For Trace, the relevant opportunity is compact local retrieval over evidence embeddings:

- store prompt/action/evidence embeddings inside customer environment
- compress vectors to reduce memory footprint
- query similar risky actions, workflows, and review outcomes
- keep raw evidence and hashes authoritative

This belongs in the Trace Data Plane or Trust Plane search path, not in the policy authority itself.

## Next Training Targets

1. Expand Data Plane action traces.
2. Add policy posture examples with observe vs enforce modes.
3. Add tool-call workflow sequences, not only single prompts.
4. Add role-specific tasks for CISO, general counsel, compliance, AI platform, and operations.
5. Add red-team attack suites for prompt injection, exfiltration, approval bypass, and evidence tampering.
6. Train adapter only after deterministic labels pass high-risk recall gates.
7. Promote a model only if it improves held-out probe accuracy without weakening high-risk recall.
