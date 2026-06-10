import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  hashEvidenceRecord,
  loadIdentity,
  loadPolicy,
  runTraceSimulation,
  sampleGoogleSearchCall,
  sampleGoogleSearchResponse,
  samplePaymentDraftCall,
  TraceLocalStore,
  withPaymentThresholdMode,
} from "../prototype/trace-runtime/index.js";
import { analyzeUsageIntent } from "../prototype/trace-runtime/usage-intelligence.js";

const addFormats = ("default" in addFormatsModule ? addFormatsModule.default : addFormatsModule) as unknown as (ajv: Ajv2020) => void;

async function schemaValidator() {
  const schema = JSON.parse(await readFile("schemas/evidence.schema.json", "utf8"));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

describe("Trace runtime prototype", () => {
  it("emits evidence records that validate against the evidence schema", async () => {
    const validate = await schemaValidator();
    const result = runTraceSimulation({
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "observe"),
      call: samplePaymentDraftCall(),
    });

    expect(validate(result.evidence_record), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it("flags payment threshold violations in observe mode without blocking", async () => {
    const result = runTraceSimulation({
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "observe"),
      call: samplePaymentDraftCall(),
    });
    const thresholdEntry = result.evidence_record.evaluation_ledger.find((entry) => entry.rule_id === "payment-threshold");

    expect(result.action_allowed).toBe(true);
    expect(result.agent_response.error).toBeNull();
    expect(thresholdEntry).toMatchObject({
      result: "flag",
      rule_mode: "observe",
      severity: "high",
      reason: "human supervisor signature required above threshold",
    });
  });

  it("blocks payment threshold violations in enforce mode while still emitting evidence", async () => {
    const result = runTraceSimulation({
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "enforce"),
      call: samplePaymentDraftCall(),
    });
    const thresholdEntry = result.evidence_record.evaluation_ledger.find((entry) => entry.rule_id === "payment-threshold");

    expect(result.action_allowed).toBe(false);
    expect(result.agent_response.error).toEqual({
      code: "TRACE_POLICY_BLOCKED",
      message: "Action blocked by Trace policy evaluation.",
      rule_id: "payment-threshold",
    });
    expect(thresholdEntry).toMatchObject({
      result: "block",
      rule_mode: "enforce",
      severity: "high",
    });
    expect(result.evidence_record.chain_of_custody.record_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("denies identity capabilities before policy posture can excuse the action", async () => {
    const call = {
      ...samplePaymentDraftCall(),
      request_id: "vendor_modify_denied",
      tool_namespace: "finance.vendor",
      tool_name: "vendor.modify",
      action: "modify",
      resources_targeted: ["vendor:vendor_acme_industrial"],
      resources_modified: ["vendor:vendor_acme_industrial"],
      arguments: {
        vendor_id: "vendor_acme_industrial",
        routing_number: "021000021",
      },
    };

    const result = runTraceSimulation({
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "observe"),
      call,
    });

    expect(result.action_allowed).toBe(false);
    expect(result.agent_response.error?.rule_id).toBe("identity-capability-denial");
    expect(result.evidence_record.evaluation_ledger).toContainEqual(
      expect.objectContaining({
        policy_id: "identity",
        rule_id: "identity-capability-denial",
        result: "block",
        rule_mode: "enforce",
      }),
    );
  });

  it("hashes evidence records deterministically with canonical JSON", async () => {
    const input = {
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "observe"),
      call: samplePaymentDraftCall(),
    };

    const first = runTraceSimulation(input).evidence_record;
    const second = runTraceSimulation(input).evidence_record;

    expect(first.chain_of_custody.record_hash).toBe(second.chain_of_custody.record_hash);
    expect(hashEvidenceRecord(first)).toBe(first.chain_of_custody.record_hash);
  });

  it("allows the playground Google search action and emits browser-search evidence", async () => {
    const result = runTraceSimulation({
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "observe"),
      call: sampleGoogleSearchCall("accountable AI agents"),
    });

    expect(result.action_allowed).toBe(true);
    expect(result.evidence_record.action_payload).toMatchObject({
      tool_namespace: "browser.web",
      tool_name: "google.search",
      redacted_arguments_preview: {
        query: "accountable AI agents",
        destination_url: "https://www.google.com/search?q=accountable%20AI%20agents",
        llm_usage_detected: true,
        llm_surface: "google_search_with_gemini_available",
        intent_classification: "business_sensitive_workflow",
        domain_alignment: "in_domain",
        risk_level: "low",
        risk_signals: [],
      },
      resources_targeted: ["web_search:google"],
      resources_modified: [],
    });
    expect(result.evidence_record.evaluation_ledger.every((entry) => entry.result === "pass")).toBe(true);
  });

  it("flags high-risk managed AI search usage while preserving observe mode", async () => {
    const result = runTraceSimulation({
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "observe"),
      call: sampleGoogleSearchCall("how to hack employee email password"),
    });
    const reviewEntry = result.evidence_record.evaluation_ledger.find((entry) => entry.rule_id === "managed-ai-usage-review");

    expect(result.action_allowed).toBe(true);
    expect(reviewEntry).toMatchObject({
      result: "flag",
      rule_mode: "observe",
      severity: "high",
      reason: "managed AI usage requires review because risk or domain alignment crossed the business threshold",
    });
    expect(result.evidence_record.action_payload.redacted_arguments_preview).toMatchObject({
      risk_level: "high",
      domain_alignment: "out_of_domain",
    });
  });

  it("uses medium ledger severity for out-of-domain personal AI-search usage", async () => {
    const result = runTraceSimulation({
      identity: await loadIdentity(),
      policy: withPaymentThresholdMode(await loadPolicy(), "observe"),
      call: sampleGoogleSearchCall("sports betting picks tonight"),
    });
    const reviewEntry = result.evidence_record.evaluation_ledger.find((entry) => entry.rule_id === "managed-ai-usage-review");

    expect(result.action_allowed).toBe(true);
    expect(reviewEntry).toMatchObject({
      result: "flag",
      rule_mode: "observe",
      severity: "medium",
    });
    expect(result.evidence_record.action_payload.redacted_arguments_preview).toMatchObject({
      risk_level: "medium",
      domain_alignment: "out_of_domain",
      risk_signals: ["likely_unrelated_personal_use"],
    });
  });

  it("classifies managed AI search usage into operator-friendly intent and risk", () => {
    expect(analyzeUsageIntent("payment audit policy for agent approvals")).toMatchObject({
      intent_classification: "business_sensitive_workflow",
      domain_alignment: "in_domain",
      risk_level: "low",
      recommended_workflow: "Retain evidence and review if sensitive business data appears.",
    });

    expect(analyzeUsageIntent("student using gemini for homework")).toMatchObject({
      intent_classification: "education_workflow",
      domain_alignment: "adjacent",
      risk_level: "low",
      recommended_workflow: "Review against institution-specific acceptable-use policy.",
    });

    expect(analyzeUsageIntent("how to hack employee email password")).toMatchObject({
      intent_classification: "potentially_malicious_or_unsafe",
      domain_alignment: "out_of_domain",
      risk_level: "high",
      risk_signals: ["potentially_malicious_security_intent", "possible_sensitive_data_exposure"],
      recommended_workflow: "Route to security or compliance review and retain evidence.",
    });

    expect(analyzeUsageIntent("ways I can sabotage my company")).toMatchObject({
      intent_classification: "potentially_malicious_or_unsafe",
      domain_alignment: "out_of_domain",
      risk_level: "high",
      risk_signals: ["insider_threat_or_sabotage_intent"],
      recommended_workflow: "Route to security or compliance review and retain evidence.",
    });

    expect(analyzeUsageIntent("sports betting picks tonight")).toMatchObject({
      intent_classification: "general_research",
      domain_alignment: "out_of_domain",
      risk_level: "medium",
      risk_signals: ["likely_unrelated_personal_use"],
    });
  });

  it("persists ingested events to a local SQLite database for replay after reopening", async () => {
    const databasePath = join(mkdtempSync(join(tmpdir(), "trace-store-")), "trace.sqlite");
    const identity = await loadIdentity();
    const policy = withPaymentThresholdMode(await loadPolicy(), "observe");
    const call = sampleGoogleSearchCall("enterprise AI evidence records");
    const response = sampleGoogleSearchResponse("enterprise AI evidence records");
    const result = runTraceSimulation({ identity, policy, call });
    const firstStore = new TraceLocalStore(databasePath);

    firstStore.ingest(
      {
        tenant_id: "tenant_persist",
        project_id: "proj_trace",
        user_id: "user_001",
        session_id: "sess_persist",
        source: "api",
        call,
        response,
      },
      result,
      "2026-06-06T21:15:00.000Z",
    );
    firstStore.close();

    const reopenedStore = new TraceLocalStore(databasePath);
    const replay = reopenedStore.replay("sess_persist");

    expect(replay.event_count).toBe(1);
    expect(replay.events[0]).toMatchObject({
      event_id: "evt_sess_persist_0001",
      tenant_id: "tenant_persist",
      project_id: "proj_trace",
      user_id: "user_001",
      session_id: "sess_persist",
    });
    expect(replay.events[0].result.evidence_record.chain_of_custody.record_hash).toBe(result.evidence_record.chain_of_custody.record_hash);
    expect(replay.events[0].response?.response_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(replay.summary.headline).toContain("1 event replayed");
    reopenedStore.close();
  });
});
