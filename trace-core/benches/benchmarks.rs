//! Benchmarks comparing Rust vs TypeScript implementations
//!
//! Run with: cargo bench

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use serde_json::json;
use std::collections::HashMap;
// Import from the library crate
use crate::{
    canonical_json, evidence, hash, policy, redact, types::*, usage_intel,
};

// Test data
fn sample_agent_identity() -> AgentIdentity {
    AgentIdentity {
        identity_version: "2026-06-04.1".to_string(),
        agent_uuid: "7e62b14f-0e6f-4b8c-91e7-4c39f7d3a210".to_string(),
        agent_id: "accounts-payable-agent-17".to_string(),
        organization_id: "org_stria_demo_finance".to_string(),
        environment: "production".to_string(),
        owner: Owner {
            name: "Maya Chen".to_string(),
            email: "maya.chen@stria-demo.example".to_string(),
            team: "Finance Operations".to_string(),
        },
        service_account_mappings: vec![],
        allowed_tool_capabilities: vec![
            ToolCapability {
                namespace: "finance.ap".to_string(),
                tool: "invoice.read".to_string(),
                action: "read".to_string(),
            },
            ToolCapability {
                namespace: "finance.ap".to_string(),
                tool: "payment_draft.create".to_string(),
                action: "create".to_string(),
            },
            ToolCapability {
                namespace: "browser.web".to_string(),
                tool: "google.search".to_string(),
                action: "search".to_string(),
            },
        ],
        allowed_network_destinations: vec![
            "api.bank-sandbox.example".to_string(),
            "invoices.internal.stria-demo.example".to_string(),
            "www.google.com".to_string(),
        ],
        allowed_resource_scopes: vec![
            "invoice:*".to_string(),
            "payment_draft:*".to_string(),
            "web_search:*".to_string(),
        ],
        denied_tool_capabilities: vec![
            ToolCapability {
                namespace: "finance.ap".to_string(),
                tool: "payment.approve".to_string(),
                action: "approve".to_string(),
            },
            ToolCapability {
                namespace: "finance.vendor".to_string(),
                tool: "vendor.modify".to_string(),
                action: "modify".to_string(),
            },
        ],
    }
}

fn sample_agent_tool_call(threshold_exceeded: bool) -> AgentToolCall {
    let mut arguments = HashMap::new();
    arguments.insert("invoice_id".to_string(), json!("INV-2026-1188"));
    arguments.insert("vendor_id".to_string(), json!("vendor_acme_industrial"));
    arguments.insert("amount_usd".to_string(), json!(if threshold_exceeded { 12500 } else { 5000 }));
    arguments.insert("payment_method".to_string(), json!("ach"));
    arguments.insert("account_number".to_string(), json!("000123456789"));
    arguments.insert("supervisor_signature".to_string(), json!(null));

    AgentToolCall {
        request_id: "ap_12500_payment_draft".to_string(),
        agent_id: "accounts-payable-agent-17".to_string(),
        prompt: "Create a payment draft for Acme Industrial Supplies invoice INV-2026-1188.".to_string(),
        model_provider: "openai".to_string(),
        model_name: "gpt-5".to_string(),
        model_config: {
            let mut map = HashMap::new();
            map.insert("temperature".to_string(), json!(0.2));
            map.insert("max_output_tokens".to_string(), json!(1200));
            map.insert("tool_choice".to_string(), json!("required"));
            map
        },
        parent_context: None,
        tool_namespace: "finance.ap".to_string(),
        tool_name: "payment_draft.create".to_string(),
        action: "create".to_string(),
        arguments,
        resources_targeted: vec!["invoice:INV-2026-1188".to_string(), "vendor:vendor_acme_industrial".to_string()],
        resources_modified: vec!["payment_draft:pending".to_string()],
        network_destination: "api.bank-sandbox.example".to_string(),
        received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
    }
}

fn sample_policy_spec() -> PolicySpec {
    PolicySpec {
        policy_id: "pol_accounts_payable_agentic_controls".to_string(),
        policy_version: "2026-06-04.1".to_string(),
        global_mode: "observe".to_string(),
        rules: vec![
            PolicyRule {
                id: "pii-detection".to_string(),
                description: "Detect sensitive personal information in payment workflow arguments.".to_string(),
                rule_mode: Some("observe".to_string()),
                interrupt: "soft".to_string(),
                severity: "medium".to_string(),
                detector: "pii".to_string(),
                reason: "PII detected in tool arguments; redact and review retained evidence.".to_string(),
                threshold_usd: None,
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![],
            },
            PolicyRule {
                id: "token-leakage".to_string(),
                description: "Detect access tokens, API keys, or bearer credentials in arguments.".to_string(),
                rule_mode: Some("enforce".to_string()),
                interrupt: "hard".to_string(),
                severity: "critical".to_string(),
                detector: "token_leakage".to_string(),
                reason: "Credential material cannot be sent through the agent action plane.".to_string(),
                threshold_usd: None,
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![],
            },
            PolicyRule {
                id: "payment-threshold".to_string(),
                description: "Require supervisor signature for payment drafts above 10000 USD.".to_string(),
                rule_mode: Some("observe".to_string()),
                interrupt: "soft".to_string(),
                severity: "high".to_string(),
                detector: "payment_threshold".to_string(),
                reason: "human supervisor signature required above threshold".to_string(),
                threshold_usd: Some(10000.0),
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![],
            },
            PolicyRule {
                id: "forbidden-vendor-modification".to_string(),
                description: "Accounts payable agents cannot modify vendor records.".to_string(),
                rule_mode: Some("enforce".to_string()),
                interrupt: "hard".to_string(),
                severity: "critical".to_string(),
                detector: "tool_forbidden".to_string(),
                reason: "agent identity does not permit vendor record modification".to_string(),
                threshold_usd: None,
                forbidden_tools: vec![ForbiddenTool {
                    namespace: "finance.vendor".to_string(),
                    tool: "vendor.modify".to_string(),
                }],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![],
            },
            PolicyRule {
                id: "production-database-deletion".to_string(),
                description: "Block destructive database actions in production.".to_string(),
                rule_mode: Some("enforce".to_string()),
                interrupt: "hard".to_string(),
                severity: "critical".to_string(),
                detector: "resource_delete".to_string(),
                reason: "production database deletion requires a separate break-glass workflow".to_string(),
                threshold_usd: None,
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec!["database:production:*".to_string()],
                allowed_destinations: vec![],
            },
            PolicyRule {
                id: "network-destination-allowlist".to_string(),
                description: "Flag destinations outside the approved network allowlist.".to_string(),
                rule_mode: Some("observe".to_string()),
                interrupt: "soft".to_string(),
                severity: "high".to_string(),
                detector: "network_allowlist".to_string(),
                reason: "network destination is outside the approved allowlist".to_string(),
                threshold_usd: None,
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![
                    "api.bank-sandbox.example".to_string(),
                    "invoices.internal.stria-demo.example".to_string(),
                    "trace-local-runtime".to_string(),
                    "api.openai.com".to_string(),
                    "www.google.com".to_string(),
                ],
            },
            PolicyRule {
                id: "managed-ai-usage-review".to_string(),
                description: "Flag high-risk or out-of-domain AI-assisted browser usage for administrative review.".to_string(),
                rule_mode: Some("observe".to_string()),
                interrupt: "soft".to_string(),
                severity: "high".to_string(),
                detector: "managed_ai_usage_review".to_string(),
                reason: "managed AI usage requires review because risk or domain alignment crossed the business threshold".to_string(),
                threshold_usd: None,
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![],
            },
        ],
    }
}

// ============================================================================
// CANONICAL JSON BENCHMARKS
// ============================================================================

fn bench_canonical_json(c: &mut Criterion) {
    let mut group = c.benchmark_group("canonical_json");

    // Small object
    let small_obj = json!({
        "a": 1,
        "b": "test",
        "c": [1, 2, 3]
    });

    group.throughput(Throughput::Bytes(small_obj.to_string().len() as u64));
    group.bench_function("small_object", |b| {
        b.iter(|| black_box(canonical_json::value_to_canonical_json(&small_obj)))
    });

    // Medium object (simulating agent tool call arguments)
    let medium_obj = json!({
        "invoice_id": "INV-2026-1188",
        "vendor_id": "vendor_acme_industrial",
        "amount_usd": 12500,
        "payment_method": "ach",
        "account_number": "000123456789",
        "supervisor_signature": null,
        "metadata": {
            "source": "erp",
            "batch_id": "batch_001",
            "line_items": [
                {"item": "widget", "qty": 100, "price": 125.00},
                {"item": "gadget", "qty": 50, "price": 200.00}
            ]
        }
    });

    group.throughput(Throughput::Bytes(medium_obj.to_string().len() as u64));
    group.bench_function("medium_object", |b| {
        b.iter(|| black_box(canonical_json::value_to_canonical_json(&medium_obj)))
    });

    group.finish();
}

// ============================================================================
// HASH BENCHMARKS
// ============================================================================

fn bench_hash(c: &mut Criterion) {
    let mut group = c.benchmark_group("hash");

    let test_string = "Create a payment draft for Acme Industrial Supplies invoice INV-2026-1188.";
    group.throughput(Throughput::Bytes(test_string.len() as u64));
    group.bench_function("sha256_string", |b| {
        b.iter(|| black_box(hash::sha256_str(test_string)))
    });

    let json_value = json!({
        "invoice_id": "INV-2026-1188",
        "amount_usd": 12500,
        "vendor": "acme"
    });
    group.throughput(Throughput::Bytes(json_value.to_string().len() as u64));
    group.bench_function("sha256_json_value", |b| {
        b.iter(|| black_box(hash::sha256_value(&json_value)))
    });

    group.finish();
}

// ============================================================================
// POLICY EVALUATION BENCHMARKS
// ============================================================================

fn bench_policy_evaluation(c: &mut Criterion) {
    let mut group = c.benchmark_group("policy_evaluation");

    let identity = sample_agent_identity();
    let policy = sample_policy_spec();

    // Identity verification
    let call_allowed = sample_agent_tool_call(false);
    group.bench_function("verify_identity_allowed", |b| {
        b.iter(|| black_box(policy::verify_identity(&identity, &call_allowed)))
    });

    let call_denied = sample_agent_tool_call(false);
    group.bench_function("verify_identity_denied", |b| {
        b.iter(|| {
            let mut id = identity.clone();
            id.allowed_tool_capabilities.clear();
            black_box(policy::verify_identity(&id, &call_denied))
        })
    });

    // Full policy evaluation
    let call_below = sample_agent_tool_call(false);
    group.bench_function("evaluate_policy_below_threshold", |b| {
        b.iter(|| black_box(policy::evaluate_policy(&policy, &call_below)))
    });

    let call_above = sample_agent_tool_call(true);
    group.bench_function("evaluate_policy_above_threshold", |b| {
        b.iter(|| black_box(policy::evaluate_policy(&policy, &call_above)))
    });

    group.finish();
}

// ============================================================================
// USAGE INTELLIGENCE BENCHMARKS
// ============================================================================

fn bench_usage_intel(c: &mut Criterion) {
    let mut group = c.benchmark_group("usage_intelligence");

    let queries = vec![
        ("simple_arithmetic", "what is 5 x 10"),
        ("business_workflow", "payment audit policy for agent approvals"),
        ("technical_workflow", "debug database schema migration error"),
        ("insider_risk", "how to sabotage my company"),
        ("unsafe_security", "how to hack a database"),
        ("personal_use", "movie streaming sites"),
        ("long_query", "I need to create a payment draft for Acme Industrial Supplies invoice INV-2026-1188 with an amount of 12500 USD via ACH and ensure it has proper supervisor signature approval"),
    ];

    for (name, query) in queries {
        group.throughput(Throughput::Bytes(query.len() as u64));
        group.bench_with_input(BenchmarkId::new("analyze", name), query, |b, q| {
            b.iter(|| black_box(usage_intel::analyze_usage_intel(q).unwrap()))
        });
    }

    group.finish();
}

// ============================================================================
// REDACTION BENCHMARKS
// ============================================================================

fn bench_redaction(c: &mut Criterion) {
    let mut group = c.benchmark_group("redaction");

    let args_no_secrets = json!({
        "invoice_id": "INV-2026-1188",
        "vendor_id": "vendor_acme",
        "amount_usd": 5000,
        "description": "Normal payment for office supplies"
    });

    let args_with_secrets = json!({
        "account_number": "123456789",
        "api_key": "sk-abcdefghijklmnop",
        "token": "Bearer xyz123",
        "description": "Payment with sensitive data",
        "nested": {
            "password": "secret123",
            "public_field": "visible"
        }
    });

    group.bench_function("redact_no_secrets", |b| {
        b.iter(|| black_box(redact::redacted_preview(&args_no_secrets.as_object().unwrap().clone())))
    });

    group.bench_function("redact_with_secrets", |b| {
        b.iter(|| black_box(redact::redacted_preview(&args_with_secrets.as_object().unwrap().clone())))
    });

    group.finish();
}

// ============================================================================
// FULL SIMULATION BENCHMARKS
// ============================================================================

fn bench_full_simulation(c: &mut Criterion) {
    let mut group = c.benchmark_group("full_simulation");

    let identity = sample_agent_identity();
    let policy = sample_policy_spec();

    // Below threshold (allowed)
    let call_allowed = sample_agent_tool_call(false);
    group.bench_function("simulate_allowed", |b| {
        b.iter(|| {
            black_box(evidence::run_trace_simulation(
                &identity,
                &policy,
                &call_allowed,
                None,
                "2026-06-04T14:00:01.000Z",
                "2026-06-04T14:00:02.000Z",
            ).unwrap())
        })
    });

    // Above threshold (flagged in observe mode)
    let call_flagged = sample_agent_tool_call(true);
    group.bench_function("simulate_flagged", |b| {
        b.iter(|| {
            black_box(evidence::run_trace_simulation(
                &identity,
                &policy,
                &call_flagged,
                None,
                "2026-06-04T14:00:01.000Z",
                "2026-06-04T14:00:02.000Z",
            ).unwrap())
        })
    });

    group.finish();
}

// ============================================================================
// EVIDENCE HASHING BENCHMARKS
// ============================================================================

fn bench_evidence_hashing(c: &mut Criterion) {
    let mut group = c.benchmark_group("evidence_hashing");

    let identity = sample_agent_identity();
    let policy = sample_policy_spec();
    let call = sample_agent_tool_call(false);

    let result = evidence::run_trace_simulation(
        &identity,
        &policy,
        &call,
        None,
        "2026-06-04T14:00:01.000Z",
        "2026-06-04T14:00:02.000Z",
    ).unwrap();

    let record = serde_json::to_value(&result.evidence_record).unwrap();

    group.bench_function("hash_evidence_record", |b| {
        b.iter(|| black_box(hash::hash_evidence_record(&record).unwrap()))
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_canonical_json,
    bench_hash,
    bench_policy_evaluation,
    bench_usage_intel,
    bench_redaction,
    bench_full_simulation,
    bench_evidence_hashing
);

criterion_main!(benches);