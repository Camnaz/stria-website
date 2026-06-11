//! Data Simulation & Observation Tool for Trace
//!
//! Generates test scenarios, runs them through trace simulation,
//! and observes/records results for validation and analysis.
//!
//! Run with: cargo run --example data_simulation

use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::time::Instant;
use trace_core::{evidence, hash, redact, types::*, usage_intel};

/// Test scenario definition
#[derive(Debug, Clone)]
struct TestScenario {
    name: String,
    description: String,
    identity: AgentIdentity,
    policy: PolicySpecInternal,
    calls: Vec<AgentToolCallInternal>,
    expected_mode: String,
    expected_allowed: bool,
    expected_rule_id: Option<String>,
}

/// Simulation result with observation data
#[derive(Debug, serde::Serialize)]
struct ObservedResult {
    scenario_name: String,
    timestamp: String,
    duration_ns: u128,
    mode: String,
    action_allowed: bool,
    rule_triggered: Option<String>,
    evidence_record: EvidenceRecordInternal,
    evaluation_ledger: Vec<EvaluationLedgerEntry>,
}

/// Generate a standard test identity
fn create_test_identity(agent_id: &str, capabilities: Vec<ToolCapability>) -> AgentIdentity {
    AgentIdentity {
        identity_version: "2026-06-04.1".to_string(),
        agent_uuid: format!("{}-{:08x}", agent_id, rand::random::<u32>()),
        agent_id: agent_id.to_string(),
        organization_id: "org_stria_demo_finance".to_string(),
        environment: "production".to_string(),
        owner: Owner {
            name: "Maya Chen".to_string(),
            email: "maya.chen@stria-demo.example".to_string(),
            team: "Finance Operations".to_string(),
        },
        service_account_mappings: vec![],
        allowed_tool_capabilities: capabilities,
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

/// Create a standard payment policy
fn create_payment_policy(global_mode: Option<&str>) -> PolicySpecInternal {
    PolicySpecInternal {
        policy_id: "pol_accounts_payable_agentic_controls".to_string(),
        policy_version: "2026-06-04.1".to_string(),
        global_mode: global_mode.unwrap_or("observe").to_string(),
        rules: vec![
            PolicyRuleInternal {
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
            PolicyRuleInternal {
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
            PolicyRuleInternal {
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
            PolicyRuleInternal {
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
            PolicyRuleInternal {
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
            PolicyRuleInternal {
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
            PolicyRuleInternal {
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

/// Create a payment policy with payment-threshold rule_mode = enforce
fn create_payment_policy_with_threshold_enforce() -> PolicySpecInternal {
    let mut policy = create_payment_policy(Some("observe"));
    // Find and update the payment-threshold rule
    for rule in &mut policy.rules {
        if rule.id == "payment-threshold" {
            rule.rule_mode = Some("enforce".to_string());
        }
    }
    policy
}

/// Create a payment draft tool call
fn create_payment_call(
    request_id: &str,
    amount_usd: u64,
    supervisor_signature: Option<String>,
) -> AgentToolCallInternal {
    let mut arguments = HashMap::new();
    arguments.insert("invoice_id".to_string(), json!("INV-2026-1188"));
    arguments.insert("vendor_id".to_string(), json!("vendor_acme_industrial"));
    arguments.insert("amount_usd".to_string(), json!(amount_usd));
    arguments.insert("payment_method".to_string(), json!("ach"));
    arguments.insert("account_number".to_string(), json!("000123456789"));
    arguments.insert(
        "supervisor_signature".to_string(),
        json!(supervisor_signature),
    );

    let mut model_config = HashMap::new();
    model_config.insert("temperature".to_string(), json!(0.2));
    model_config.insert("max_output_tokens".to_string(), json!(1200));
    model_config.insert("tool_choice".to_string(), json!("required"));

    AgentToolCallInternal {
        request_id: request_id.to_string(),
        agent_id: "accounts-payable-agent-17".to_string(),
        prompt: "Create a payment draft for Acme Industrial Supplies invoice INV-2026-1188."
            .to_string(),
        model_provider: "openai".to_string(),
        model_name: "gpt-5".to_string(),
        model_config,
        parent_context: None,
        tool_namespace: "finance.ap".to_string(),
        tool_name: "payment_draft.create".to_string(),
        action: "create".to_string(),
        arguments,
        resources_targeted: vec![
            "invoice:INV-2026-1188".to_string(),
            "vendor:vendor_acme_industrial".to_string(),
        ],
        resources_modified: vec!["payment_draft:pending".to_string()],
        network_destination: "api.bank-sandbox.example".to_string(),
        received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
    }
}

/// Create a vendor modification call (should be forbidden)
fn create_vendor_mod_call(request_id: &str) -> AgentToolCallInternal {
    let mut arguments = HashMap::new();
    arguments.insert("vendor_id".to_string(), json!("vendor_acme"));
    arguments.insert("new_name".to_string(), json!("Acme Updated"));

    let mut model_config = HashMap::new();
    model_config.insert("temperature".to_string(), json!(0.2));

    AgentToolCallInternal {
        request_id: request_id.to_string(),
        agent_id: "accounts-payable-agent-17".to_string(),
        prompt: "Update vendor record for Acme Industrial.".to_string(),
        model_provider: "openai".to_string(),
        model_name: "gpt-5".to_string(),
        model_config,
        parent_context: None,
        tool_namespace: "finance.vendor".to_string(),
        tool_name: "vendor.modify".to_string(),
        action: "modify".to_string(),
        arguments,
        resources_targeted: vec!["vendor:vendor_acme".to_string()],
        resources_modified: vec!["vendor:vendor_acme".to_string()],
        network_destination: "invoices.internal.stria-demo.example".to_string(),
        received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
    }
}

/// Create a call with PII in arguments
fn create_pii_call(request_id: &str) -> AgentToolCallInternal {
    let mut arguments = HashMap::new();
    arguments.insert("invoice_id".to_string(), json!("INV-2026-1188"));
    arguments.insert("vendor_id".to_string(), json!("vendor_acme"));
    arguments.insert("amount_usd".to_string(), json!(5000));
    arguments.insert("ssn".to_string(), json!("123-45-6789")); // PII
    arguments.insert("employee_name".to_string(), json!("John Doe")); // PII

    let mut model_config = HashMap::new();
    model_config.insert("temperature".to_string(), json!(0.2));

    AgentToolCallInternal {
        request_id: request_id.to_string(),
        agent_id: "accounts-payable-agent-17".to_string(),
        prompt: "Process payment with employee info.".to_string(),
        model_provider: "openai".to_string(),
        model_name: "gpt-5".to_string(),
        model_config,
        parent_context: None,
        tool_namespace: "finance.ap".to_string(),
        tool_name: "payment_draft.create".to_string(),
        action: "create".to_string(),
        arguments,
        resources_targeted: vec!["invoice:INV-2026-1188".to_string()],
        resources_modified: vec!["payment_draft:pending".to_string()],
        network_destination: "api.bank-sandbox.example".to_string(),
        received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
    }
}

/// Create a call with token leakage
fn create_token_leak_call(request_id: &str) -> AgentToolCallInternal {
    let mut arguments = HashMap::new();
    arguments.insert("invoice_id".to_string(), json!("INV-2026-1188"));
    arguments.insert("amount_usd".to_string(), json!(5000));
    arguments.insert("api_key".to_string(), json!("sk-12345secret")); // Token
    arguments.insert("authorization".to_string(), json!("Bearer token123")); // Token

    let mut model_config = HashMap::new();
    model_config.insert("temperature".to_string(), json!(0.2));

    AgentToolCallInternal {
        request_id: request_id.to_string(),
        agent_id: "accounts-payable-agent-17".to_string(),
        prompt: "Process payment with credentials.".to_string(),
        model_provider: "openai".to_string(),
        model_name: "gpt-5".to_string(),
        model_config,
        parent_context: None,
        tool_namespace: "finance.ap".to_string(),
        tool_name: "payment_draft.create".to_string(),
        action: "create".to_string(),
        arguments,
        resources_targeted: vec!["invoice:INV-2026-1188".to_string()],
        resources_modified: vec!["payment_draft:pending".to_string()],
        network_destination: "api.bank-sandbox.example".to_string(),
        received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
    }
}

/// Create a call with unallowed network destination
fn create_bad_destination_call(request_id: &str) -> AgentToolCallInternal {
    let mut arguments = HashMap::new();
    arguments.insert("invoice_id".to_string(), json!("INV-2026-1188"));
    arguments.insert("amount_usd".to_string(), json!(5000));

    let mut model_config = HashMap::new();
    model_config.insert("temperature".to_string(), json!(0.2));

    AgentToolCallInternal {
        request_id: request_id.to_string(),
        agent_id: "accounts-payable-agent-17".to_string(),
        prompt: "Process payment.".to_string(),
        model_provider: "openai".to_string(),
        model_name: "gpt-5".to_string(),
        model_config,
        parent_context: None,
        tool_namespace: "finance.ap".to_string(),
        tool_name: "payment_draft.create".to_string(),
        action: "create".to_string(),
        arguments,
        resources_targeted: vec!["invoice:INV-2026-1188".to_string()],
        resources_modified: vec!["payment_draft:pending".to_string()],
        network_destination: "evil.external.site".to_string(), // Not allowed
        received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
    }
}

/// Build all test scenarios
fn build_scenarios() -> Vec<TestScenario> {
    let capabilities = vec![
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
    ];

    let identity = create_test_identity("accounts-payable-agent-17", capabilities);

    vec![
        // Normal allowed payment below threshold
        TestScenario {
            name: "normal_payment_below_threshold".to_string(),
            description: "Normal payment draft below $10k threshold - should be allowed in observe mode".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy(Some("observe")),
            calls: vec![create_payment_call("sc1_pay_5k", 5000, None)],
            expected_mode: "observe".to_string(),
            expected_allowed: true,
            expected_rule_id: None,
        },
        // Payment above threshold in observe mode (flagged but allowed)
        TestScenario {
            name: "payment_above_threshold_observe".to_string(),
            description: "Payment draft above $10k in observe mode - should be flagged but allowed".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy(Some("observe")),
            calls: vec![create_payment_call("sc2_pay_15k", 15000, None)],
            expected_mode: "observe".to_string(),
            expected_allowed: true,
            expected_rule_id: Some("payment-threshold".to_string()),
        },
        // Payment above threshold with rule_mode=enforce (blocked)
        TestScenario {
            name: "payment_above_threshold_enforce".to_string(),
            description: "Payment draft above $10k with rule_mode=enforce - should be blocked".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy_with_threshold_enforce(),
            calls: vec![create_payment_call("sc3_pay_15k_enforce", 15000, None)],
            expected_mode: "enforce".to_string(),
            expected_allowed: false,
            expected_rule_id: Some("payment-threshold".to_string()),
        },
        // Payment with supervisor signature - rule still triggers (no supervisor check in current impl)
        TestScenario {
            name: "payment_with_supervisor_signature".to_string(),
            description: "Payment above threshold with supervisor signature - rule still flags (no supervisor check implemented)".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy_with_threshold_enforce(),
            calls: vec![create_payment_call("sc4_pay_15k_signed", 15000, Some("supervisor_john".to_string()))],
            expected_mode: "enforce".to_string(),
            expected_allowed: false,
            expected_rule_id: Some("payment-threshold".to_string()),
        },
        // Forbidden vendor modification - identity check blocks first
        TestScenario {
            name: "forbidden_vendor_modification".to_string(),
            description: "Agent attempts vendor modification - blocked by identity capability denial (runs before tool_forbidden)".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy(Some("enforce")),
            calls: vec![create_vendor_mod_call("sc5_vendor_mod")],
            expected_mode: "enforce".to_string(),
            expected_allowed: false,
            expected_rule_id: Some("identity-capability-denial".to_string()),
        },
        // PII detection in observe mode
        TestScenario {
            name: "pii_detection_observe".to_string(),
            description: "Tool call contains PII (SSN) - should be flagged in observe mode".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy(Some("observe")),
            calls: vec![create_pii_call("sc6_pii")],
            expected_mode: "observe".to_string(),
            expected_allowed: true,
            expected_rule_id: Some("pii-detection".to_string()),
        },
        // Token leakage (should always be enforced)
        TestScenario {
            name: "token_leakage_enforced".to_string(),
            description: "Tool call contains API key - should be blocked by token_leakage rule".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy(Some("observe")), // Even in observe, token_leakage is enforce
            calls: vec![create_token_leak_call("sc7_token_leak")],
            expected_mode: "enforce".to_string(), // Token leakage forces enforce
            expected_allowed: false,
            expected_rule_id: Some("token-leakage".to_string()),
        },
        // Bad network destination
        TestScenario {
            name: "bad_network_destination".to_string(),
            description: "Tool call to unapproved network destination - should be flagged".to_string(),
            identity: identity.clone(),
            policy: create_payment_policy(Some("observe")),
            calls: vec![create_bad_destination_call("sc8_bad_dest")],
            expected_mode: "observe".to_string(),
            expected_allowed: true,
            expected_rule_id: Some("network-destination-allowlist".to_string()),
        },
    ]
}

/// Run a single scenario and collect observations
fn run_scenario(scenario: &TestScenario) -> ObservedResult {
    let start = Instant::now();

    // For simplicity, run the first call (scenarios have one call each)
    let call = &scenario.calls[0];

    let result = evidence::run_trace_simulation(
        &scenario.identity,
        &scenario.policy,
        call,
        None,
        "2026-06-04T14:00:01.000Z",
        "2026-06-04T14:00:02.000Z",
    )
    .expect("Simulation failed");

    let duration = start.elapsed().as_nanos();

    // Find the blocking/triggering rule
    let rule_triggered = result
        .evidence_record
        .evaluation_ledger
        .iter()
        .find(|e| e.result == "block" || e.result == "flag")
        .map(|e| e.rule_id.clone());

    ObservedResult {
        scenario_name: scenario.name.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        duration_ns: duration,
        mode: result.mode.clone(),
        action_allowed: result.action_allowed,
        rule_triggered,
        evidence_record: result.evidence_record.clone(),
        evaluation_ledger: result.evidence_record.evaluation_ledger.clone(),
    }
}

/// Validate results against expectations
fn validate_result(scenario: &TestScenario, observed: &ObservedResult) -> Vec<String> {
    let mut errors = Vec::new();

    if observed.mode != scenario.expected_mode {
        errors.push(format!(
            "Mode mismatch: expected '{}', got '{}'",
            scenario.expected_mode, observed.mode
        ));
    }

    if observed.action_allowed != scenario.expected_allowed {
        errors.push(format!(
            "Action allowed mismatch: expected {}, got {}",
            scenario.expected_allowed, observed.action_allowed
        ));
    }

    if scenario.expected_rule_id != observed.rule_triggered {
        errors.push(format!(
            "Rule triggered mismatch: expected {:?}, got {:?}",
            scenario.expected_rule_id, observed.rule_triggered
        ));
    }

    // Validate evidence record integrity
    let record_value = serde_json::to_value(&observed.evidence_record).unwrap();
    let mut record_clone = record_value.clone();
    if let Value::Object(ref mut map) = record_clone {
        if let Some(Value::Object(ref mut custody)) = map.get_mut("chain_of_custody") {
            custody.remove("record_hash");
            custody.remove("signature_stub");
        }
    }
    let recomputed_hash = hash::sha256_value(&record_clone);
    if observed.evidence_record.chain_of_custody.record_hash != recomputed_hash {
        errors.push(
            "Evidence record hash validation failed - chain of custody corrupted".to_string(),
        );
    }

    errors
}

fn main() {
    println!("🔬 Trace Data Simulation & Observation Tool");
    println!("============================================");

    let scenarios = build_scenarios();
    let mut all_results = Vec::new();
    let mut total_errors = 0;

    println!("\nRunning {} test scenarios...\n", scenarios.len());

    for scenario in &scenarios {
        print!("  [{}] ", scenario.name);
        std::io::Write::flush(&mut std::io::stdout()).unwrap();

        let observed = run_scenario(scenario);
        let errors = validate_result(scenario, &observed);

        if errors.is_empty() {
            println!("✅ PASS ({} ns)", observed.duration_ns);
        } else {
            println!("❌ FAIL ({} ns)", observed.duration_ns);
            for e in &errors {
                println!("    - {}", e);
            }
            total_errors += errors.len();
        }

        all_results.push((scenario.clone(), observed));
    }

    // Print summary
    println!("\n{}", "=".repeat(60));
    println!("SUMMARY");
    println!("{}", "=".repeat(60));
    println!("Total scenarios: {}", scenarios.len());
    println!("Passed: {}", scenarios.len() - total_errors);
    println!("Failed: {}", total_errors);

    if total_errors == 0 {
        println!("\n🎉 All scenarios passed!");
    } else {
        println!("\n⚠️  {} validation error(s) found", total_errors);
        std::process::exit(1);
    }

    // Export detailed results as JSON
    let output: Vec<serde_json::Value> = all_results
        .iter()
        .map(|(scenario, observed)| {
            json!({
                "scenario": {
                    "name": scenario.name,
                    "description": scenario.description,
                    "expected_mode": scenario.expected_mode,
                    "expected_allowed": scenario.expected_allowed,
                    "expected_rule_id": scenario.expected_rule_id,
                },
                "observed": observed,
            })
        })
        .collect();

    let output_path = "simulation_results.json";
    fs::write(output_path, serde_json::to_string_pretty(&output).unwrap()).unwrap();
    println!("\n📁 Detailed results written to: {}", output_path);

    // Print performance summary
    println!("\n⚡ PERFORMANCE SUMMARY (nanoseconds):");
    println!("{:<45} {:>12}", "Scenario", "Duration");
    println!("{}", "-".repeat(58));
    for (_, observed) in &all_results {
        println!(
            "{:<45} {:>12}",
            observed.scenario_name, observed.duration_ns
        );
    }

    // Test redacted arguments preview
    println!("\n🔍 REDACTION PREVIEW EXAMPLES:");
    let test_args = json!({
        "invoice_id": "INV-123",
        "account_number": "123456789",
        "api_key": "sk-secret123",
        "normal_field": "visible"
    });
    let redacted = redact::redacted_preview(&test_args.as_object().unwrap().clone());
    println!("Original:  {}", serde_json::to_string(&test_args).unwrap());
    println!("Redacted:  {}", serde_json::to_string(&redacted).unwrap());

    // Test usage intelligence
    println!("\n🧠 USAGE INTELLIGENCE EXAMPLES:");
    let queries = vec![
        "Create a payment draft for invoice",
        "How to hack a database",
        "Movie streaming recommendations",
    ];
    for q in queries {
        let ui = usage_intel::analyze_usage_intent(q).unwrap();
        println!(
            "  '{}' → {} / {} / {}",
            q, ui.intent_classification, ui.risk_level, ui.domain_alignment
        );
    }
}
