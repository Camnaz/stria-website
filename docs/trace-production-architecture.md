# Trace Production Architecture

Trace should become an enterprise AI usage control layer for managed devices, browser sessions, and approved AI applications. The demo proves the operator workflow; production should separate capture, policy, evidence, and review.

## Production Goal

Trace observes managed LLM usage across company-controlled surfaces, identifies business intent and policy drift, and alerts operators when a user or agent is moving outside approved guidance.

This is not a consumer surveillance tool. Production deployments should require enterprise authorization, employee/user notice where required, tenant-owned data retention, redaction, access controls, and audit trails.

## Capture Surfaces

1. Browser extension for managed Chrome, Edge, and Brave profiles.
   - Capture prompts, model responses, URL/app surface, timestamps, user/session/device, and tenant policy context.
   - Detect known LLM surfaces and enterprise chatbot products.
   - Emit redacted previews and hashes before storage.

2. macOS endpoint agent for company-managed devices.
   - Observe approved AI application windows, local chatbot clients, and browser usage metadata.
   - Send operator notifications for high-risk active sessions.
   - Respect MDM deployment policy and tenant-defined capture scope.

3. Server-side SDK / middleware.
   - Wrap enterprise bots and agent tool calls directly.
   - Capture full structured interaction data when the customer owns the application.
   - This is the highest-fidelity path and should be preferred for internal AI products.

4. Network and identity integrations.
   - Use IdP, device posture, CASB/SASE, and proxy logs as context.
   - Do not depend on network inspection alone because encrypted/browser AI usage can hide the prompt/response content.

## Planes

### Data Plane

Runs in the customer environment. Captures LLM usage, evaluates identity and policy, redacts sensitive previews, emits evidence, and optionally blocks or interrupts.

### Control Plane

Manages policies, personas, environments, users, departments, review queues, notification routing, and integrations.

### Trust Plane

Aggregates evidence hashes, creates Merkle roots, stores custody metadata, and proves that records were not altered after review.

## Operator Workflow

1. Observe active LLM session.
2. Classify intent, domain, risk, and policy posture.
3. Show why Trace parsed key text.
4. Recommend next action: observe, review, notify, create policy candidate, or inspect evidence.
5. Preserve evidence before enforcement.
6. Feed labeled outcomes into evals and local/tenant-specific adapters.

## Long Conversation Detection

Trace should score each turn and the session as a whole:

- domain drift over time
- token drain against non-business work
- repeated attempts to move outside bot constraints
- sensitive data introduction
- adversarial or insider-risk language
- policy ambiguity and repeated workflow friction

The operator should see both the latest turn and the accumulated session posture.

## Notification Path

High-risk events should support:

- in-browser operator alert
- macOS notification from endpoint agent
- Slack / Teams / email escalation
- SIEM / SOAR event
- review queue item

Notification should include risk, user/session, business surface, rule, evidence hash, and recommended owner.

## Near-Term Upgrade Path

1. Expand the local persona simulator into 10-15 minute scripted sessions.
2. Store per-turn session posture and cumulative drift metrics.
3. Add browser notification and mock review-queue actions.
4. Add a browser-extension prototype for managed AI surfaces.
5. Add macOS endpoint notifier prototype behind explicit local permission.
6. Add tenant policy profiles by department and domain.
7. Train/evaluate adapters only against held-out long-session transcripts.
