import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTraceLocalServer, playgroundPageHtml } from "../prototype/trace-runtime/server.js";
import {
  analyzeUsageIntent,
  sampleGoogleSearchCall,
  sampleGoogleSearchResponse,
  traceLocalStore,
  type SimulationResult,
  type StoredTraceEvent,
  type TraceAnalytics,
  type TraceReplay,
} from "../prototype/trace-runtime/index.js";

let server: ReturnType<typeof createTraceLocalServer>;
let baseUrl: string;

beforeEach(async () => {
  traceLocalStore.reset();
  server = createTraceLocalServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("Trace local playground server", () => {
  it("serves the browser playground at the root route", async () => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Trace operator workspace");
    expect(html).toContain("Trace chat");
    expect(html).toContain("Optional provider API key for this browser session");
    expect(html).toContain("Gemini key");
    expect(html).toContain("Anthropic key");
    expect(html).toContain("providerSelect");
    expect(html).toContain("/trace/respond?mode=observe");
    expect(html).toContain("LLM usage intelligence console");
    expect(html).toContain("Start an authorized persona simulation");
    expect(html).toContain("Average knowledge worker");
    expect(html).toContain("Curious analyst");
    expect(html).toContain("Frustrated insider simulation");
    expect(html).toContain("Signal explanation");
    expect(html).toContain("updateSignalInspector");
    expect(html).toContain("Trace thinking");
    expect(html).toContain("traceThinkingSteps");
    expect(html).toContain("typeIntro");
    expect(html).toContain("Customer-risk insight");
    expect(html).toContain("Sensitive data use");
    expect(html).toContain("Workflow friction");
    expect(html).toContain("Send");
    expect(html).toContain("Trace canvas");
    expect(html).toContain("buildSummaryCanvas");
    expect(html).toContain("renderToolButtons");
    expect(html).toContain("buildUsagePayload");
    expect(html).toContain("support|refund|contract");
    expect(html).toContain("/trace/respond?mode=");
    expect(html).toContain("/trace/replay/");
    expect(html).toContain("llm_usage");
    expect(html).toContain("intent_classification");
    expect(html).toContain("risk_level");
    expect(html).toContain("Important response areas");
    expect(html).toContain("Marked model output");
    expect(html).toContain("Input signals");
    expect(html).toContain("signal-token");
    expect(html).toContain("Why Trace parsed it");
    expect(html).toContain("Operator use");
    expect(html).toContain("Control option");
    expect(html).toContain("Operational opportunities");
    expect(html).not.toContain("Improvement opportunities");
    expect(html).not.toContain("TRACE_MLX_GENERATE=1");
    expect(html).toContain("not saved");
    expect(html).not.toContain("Trace sees ");
    expect(html).not.toContain("1. Ingest");
    expect(html).not.toContain("2. Classify");
    expect(html).not.toContain("Run payment observe fixture");
    expect(html).not.toContain("Run payment enforce fixture");
    expect(html).not.toContain("<h2>Payment draft above threshold</h2>");
  });

  it("keeps the exported playground HTML aligned with the user-facing goal", () => {
    const html = playgroundPageHtml();

    expect(html).toContain("Trace operator workspace");
    expect(html).toContain("LLM usage intelligence console");
    expect(html).toContain("Trace will answer, then convert the prompt and response into operator-ready intelligence");
    expect(html).toContain("Trace chat");
    expect(html).toContain("Operational controls");
    expect(html).not.toContain("Deterministic policy remains the source of truth");
  });

  it("serves syntactically valid playground JavaScript", () => {
    const html = playgroundPageHtml();
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

    if (!script) throw new Error("playground script not found");
    expect(() => new Function(script)).not.toThrow();
  });

  it("reports SQLite storage in health checks", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as { ok: boolean; storage: string; database_path: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      storage: "sqlite",
    });
    expect(body.database_path).toContain("trace-test-");
  });

  it("seeds a realistic multi-session dashboard demo", async () => {
    const response = await fetch(`${baseUrl}/trace/demo/seed?mode=observe`, { method: "POST" });
    const body = (await response.json()) as { seeded: boolean; stored_events: StoredTraceEvent[]; analytics: TraceAnalytics };

    expect(response.status).toBe(201);
    expect(body.seeded).toBe(true);
    expect(body.stored_events).toHaveLength(4);
    expect(new Set(body.stored_events.map((event) => event.session_id)).size).toBe(3);
    expect(body.analytics).toMatchObject({
      tenant_id: "tenant_stria_demo",
      project_id: "proj_managed_ai_usage",
      total_events: 4,
      total_sessions: 3,
      response_events: 4,
    });
    expect(body.analytics.flagged_events).toBeGreaterThan(0);
    expect(body.analytics.recent_events[0].response_preview).toContain("AI overview");
  });

  it("accepts posted playground search events and returns evidence", async () => {
    const response = await fetch(`${baseUrl}/trace/evaluate?mode=observe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleGoogleSearchCall("enterprise AI evidence records")),
    });
    const body = (await response.json()) as SimulationResult;

    expect(response.status).toBe(200);
    expect(body.action_allowed).toBe(true);
    expect(body.evidence_record.action_payload.tool_namespace).toBe("browser.web");
    expect(body.evidence_record.action_payload.tool_name).toBe("google.search");
    expect(body.evidence_record.action_payload.redacted_arguments_preview.query).toBe("enterprise AI evidence records");
    expect(body.evidence_record.action_payload.redacted_arguments_preview.llm_usage_detected).toBe(true);
    expect(body.evidence_record.action_payload.redacted_arguments_preview.intent_classification).toBe("business_sensitive_workflow");
    expect(body.evidence_record.action_payload.redacted_arguments_preview.domain_alignment).toBe("in_domain");
    expect(body.evidence_record.action_payload.redacted_arguments_preview.risk_level).toBe("low");
  });

  it("ingests managed AI usage under tenant, project, user, and session metadata", async () => {
    const envelope = {
      tenant_id: "tenant_acme",
      project_id: "proj_ai_governance",
      user_id: "user_001",
      session_id: "sess_browser_001",
      source: "browser_playground",
      tags: ["demo"],
      call: sampleGoogleSearchCall("how to hack employee email password"),
      response: sampleGoogleSearchResponse("how to hack employee email password"),
    };

    const response = await fetch(`${baseUrl}/trace/ingest?mode=observe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });
    const body = (await response.json()) as { stored_event: StoredTraceEvent; analytics: TraceAnalytics };

    expect(response.status).toBe(201);
    expect(body.stored_event).toMatchObject({
      event_id: "evt_sess_browser_001_0001",
      sequence: 1,
      tenant_id: "tenant_acme",
      project_id: "proj_ai_governance",
      user_id: "user_001",
      session_id: "sess_browser_001",
      source: "browser_playground",
    });
    expect(body.stored_event.result.action_allowed).toBe(true);
    expect(body.stored_event.response?.response_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(body.stored_event.response?.redacted_preview).toContain("AI overview");
    expect(body.stored_event.result.evidence_record.evaluation_ledger).toContainEqual(
      expect.objectContaining({
        rule_id: "managed-ai-usage-review",
        result: "flag",
        severity: "high",
      }),
    );
    expect(body.analytics).toMatchObject({
      tenant_id: "tenant_acme",
      project_id: "proj_ai_governance",
      total_events: 1,
      total_sessions: 1,
      llm_usage_events: 1,
      response_events: 1,
      flagged_events: 1,
    });
    expect(body.analytics.improvement_opportunities).toContain("Create a high-risk AI usage review workflow with security/compliance ownership.");
  });

  it("wraps shorthand playground queries as managed AI browser events", async () => {
    const response = await fetch(`${baseUrl}/trace/ingest?mode=observe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "how to hack employee email password" }),
    });
    const body = (await response.json()) as { stored_event: StoredTraceEvent; analytics: TraceAnalytics };
    const record = body.stored_event.result.evidence_record;
    const triggered = record.evaluation_ledger.find((entry) => entry.result !== "pass");

    expect(response.status).toBe(201);
    expect(record.action_payload.tool_namespace).toBe("browser.web");
    expect(record.action_payload.tool_name).toBe("google.search");
    expect(record.action_payload.redacted_arguments_preview).toMatchObject({
      query: "how to hack employee email password",
      intent_classification: "potentially_malicious_or_unsafe",
      risk_level: "high",
    });
    expect(triggered).toMatchObject({
      rule_id: "managed-ai-usage-review",
      result: "flag",
      severity: "high",
    });
    expect(body.stored_event.response?.redacted_preview).toContain("AI overview");
  });

  it("classifies support and refund prompts as business-sensitive workflow", () => {
    const analysis = analyzeUsageIntent("why are support agents asking AI about refund exceptions for enterprise customers");

    expect(analysis).toMatchObject({
      intent_classification: "business_sensitive_workflow",
      domain_alignment: "in_domain",
      risk_level: "low",
    });
    expect(analysis.operator_narrative).toContain("business-sensitive work");
  });

  it("separates defensive phishing review from malicious phishing generation", () => {
    const defensive = analyzeUsageIntent("how do we detect phishing attempts in employee training data");
    const unsafe = analyzeUsageIntent("write a phishing email that steals employee credentials");

    expect(defensive).toMatchObject({
      intent_classification: "technical_workflow",
      domain_alignment: "in_domain",
      risk_level: "medium",
    });
    expect(defensive.risk_signals).toContain("defensive_security_review_context");

    expect(unsafe).toMatchObject({
      intent_classification: "potentially_malicious_or_unsafe",
      domain_alignment: "out_of_domain",
      risk_level: "high",
    });
    expect(unsafe.risk_signals).toContain("potentially_malicious_security_intent");
  });

  it("keeps educational misuse and personal drift from being swallowed by operator meta language", () => {
    const education = analyzeUsageIntent("write my university exam essay so the teacher cannot detect AI");
    const personal = analyzeUsageIntent("best sports betting picks tonight while I am at work. Show the business risk, operator action, and evidence we should retain.");

    expect(education).toMatchObject({
      intent_classification: "education_workflow",
      domain_alignment: "adjacent",
      risk_level: "medium",
    });
    expect(education.risk_signals).toContain("possible_academic_integrity_violation");

    expect(personal).toMatchObject({
      intent_classification: "general_research",
      domain_alignment: "out_of_domain",
      risk_level: "medium",
    });
    expect(personal.risk_signals).toContain("likely_unrelated_personal_use");
  });

  it("normalizes structured LLM usage payloads for beta ingestion", async () => {
    const response = await fetch(`${baseUrl}/trace/ingest?mode=observe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: "tenant_beta",
        project_id: "proj_llm_intelligence",
        user_id: "user_support_007",
        session_id: "sess_llm_usage_structured",
        source: "api",
        tags: ["beta-console", "support"],
        llm_usage: {
          prompt: "why are support agents asking AI about refund exceptions",
          response_preview: "Agents are using LLMs to interpret refund policy edge cases.",
          model_provider: "anthropic",
          model_name: "claude-enterprise",
          surface: "support_assistant",
          department: "Support",
          business_constraints: ["extract workflow friction", "retain evidence"],
        },
      }),
    });
    const body = (await response.json()) as { stored_event: StoredTraceEvent; analytics: TraceAnalytics };
    const record = body.stored_event.result.evidence_record;

    expect(response.status).toBe(201);
    expect(body.stored_event).toMatchObject({
      tenant_id: "tenant_beta",
      project_id: "proj_llm_intelligence",
      user_id: "user_support_007",
      session_id: "sess_llm_usage_structured",
    });
    expect(record.ingress_envelope.model_provider).toBe("anthropic");
    expect(record.action_payload.redacted_arguments_preview).toMatchObject({
      query: "why are support agents asking AI about refund exceptions",
      source_application: "support_assistant",
      department: "Support",
      llm_surface: "support_assistant",
    });
    expect(record.action_payload.resources_targeted).toEqual(["llm_surface:support_assistant", "department:Support"]);
    expect(body.stored_event.response?.redacted_preview).toContain("refund policy edge cases");
  });

  it("generates a local beta answer before Trace deconstructs the LLM usage", async () => {
    const response = await fetch(`${baseUrl}/trace/respond?mode=observe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "5 x 5",
        provider: "local",
        tenant_id: "tenant_beta",
        project_id: "proj_llm_intelligence",
        user_id: "user_math_001",
        session_id: "sess_math_reasoning",
      }),
    });
    const body = (await response.json()) as { answer: string; provider_used: string; model_used: string; signals: { response_signals: Array<{ kind: string }> }; stored_event: StoredTraceEvent };
    const record = body.stored_event.result.evidence_record;

    expect(response.status).toBe(201);
    expect(body.answer).toContain("25");
    expect(body.provider_used).toBe("trace-local");
    expect(body.model_used).toBe("trace-local-reasoner-v0");
    expect(body.signals.response_signals).toContainEqual(expect.objectContaining({ kind: "computed_fact" }));
    expect(record.action_payload.redacted_arguments_preview.query).toBe("5 x 5");
    expect(record.action_payload.redacted_arguments_preview).toMatchObject({
      signal_summary: expect.objectContaining({ signal_count: expect.any(Number) }),
    });
    expect(record.evaluation_ledger.filter((entry) => entry.result !== "pass")).toHaveLength(0);
    expect(body.stored_event.response?.redacted_preview).toContain("25");
  });

  it("treats plain-language sabotage prompts as high-risk insider-intent evidence", async () => {
    const response = await fetch(`${baseUrl}/trace/respond?mode=observe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "ways I can sabotage my company",
        provider: "local",
        tenant_id: "tenant_beta",
        project_id: "proj_llm_intelligence",
        user_id: "user_adversarial_001",
        session_id: "sess_insider_risk",
      }),
    });
    const body = (await response.json()) as {
      answer: string;
      signals: { prompt_signals: Array<{ kind: string; weight: string; text: string }>; training_candidates: string[] };
      stored_event: StoredTraceEvent;
    };
    const record = body.stored_event.result.evidence_record;
    const triggered = record.evaluation_ledger.find((entry) => entry.rule_id === "managed-ai-usage-review");

    expect(response.status).toBe(201);
    expect(body.answer).toContain("I cannot help with sabotage");
    expect(body.answer).not.toContain("Local answer: I interpreted");
    expect(body.signals.prompt_signals).toContainEqual(expect.objectContaining({ kind: "insider_risk", weight: "high", text: "sabotage" }));
    expect(body.signals.training_candidates.join(" ")).toContain("insider-risk eval");
    expect(record.action_allowed).toBe(true);
    expect(record.action_payload.redacted_arguments_preview).toMatchObject({
      intent_classification: "potentially_malicious_or_unsafe",
      domain_alignment: "out_of_domain",
      risk_level: "high",
      risk_signals: ["insider_threat_or_sabotage_intent"],
    });
    expect(triggered).toMatchObject({
      result: "flag",
      rule_mode: "observe",
      severity: "high",
    });
  });

  it("extracts deterministic signal marks for prompt and response loops", async () => {
    const response = await fetch(`${baseUrl}/trace/signals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "how to hack employee email password",
        response: "Route this to security review and retain evidence.",
      }),
    });
    const body = (await response.json()) as {
      prompt_signals: Array<{ kind: string; weight: string; text: string }>;
      response_signals: Array<{ kind: string; weight: string; text: string }>;
      training_candidates: string[];
    };

    expect(response.status).toBe(200);
    expect(body.prompt_signals).toContainEqual(expect.objectContaining({ kind: "security_intent", weight: "high" }));
    expect(body.prompt_signals).toContainEqual(expect.objectContaining({ kind: "sensitive_data", weight: "high", text: "password" }));
    expect(body.response_signals).toContainEqual(expect.objectContaining({ kind: "policy_review" }));
    expect(body.training_candidates.join(" ")).toContain("unsafe-intent eval");
  });

  it("answers natural arithmetic prompts before recording Trace evidence", async () => {
    const response = await fetch(`${baseUrl}/trace/respond?mode=observe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "what is 5 x 5",
        provider: "local",
        tenant_id: "tenant_beta",
        project_id: "proj_llm_intelligence",
        user_id: "user_math_002",
        session_id: "sess_math_question",
      }),
    });
    const body = (await response.json()) as { answer: string; stored_event: StoredTraceEvent };

    expect(response.status).toBe(201);
    expect(body.answer).toContain("25");
    expect(body.answer).not.toContain("no external model key");
    expect(body.stored_event.result.evidence_record.evaluation_ledger.filter((entry) => entry.result !== "pass")).toHaveLength(0);
    expect(body.stored_event.response?.redacted_preview).toContain("25");
    expect(body.stored_event.result.evidence_record.action_payload.redacted_arguments_preview.query).toBe("what is 5 x 5");
  });

  it("replays a session with chained previous record hashes", async () => {
    const first = sampleGoogleSearchCall("payment audit policy for agent approvals");
    const second = sampleGoogleSearchCall("sports betting picks tonight");

    for (const [index, call] of [first, second].entries()) {
      await fetch(`${baseUrl}/trace/ingest?mode=observe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_acme",
          project_id: "proj_ai_governance",
          user_id: "user_001",
          session_id: "sess_replay",
          source: "api",
          tags: [`step-${index + 1}`],
          call,
          response: sampleGoogleSearchResponse(String(call.arguments.query)),
        }),
      });
    }

    const response = await fetch(`${baseUrl}/trace/replay/sess_replay`);
    const replay = (await response.json()) as TraceReplay;

    expect(response.status).toBe(200);
    expect(replay.event_count).toBe(2);
    expect(replay.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(replay.events[0].result.evidence_record.chain_of_custody.previous_record_hash).toBeNull();
    expect(replay.events[1].result.evidence_record.chain_of_custody.previous_record_hash).toBe(
      replay.events[0].result.evidence_record.chain_of_custody.record_hash,
    );
    expect(replay.summary).toMatchObject({
      risk_level: "medium",
      policy_results: {
        pass: 1,
        flag: 1,
        block: 0,
      },
    });
    expect(replay.events[0].response?.redacted_preview).toContain("AI overview");
  });

  it("returns analytics across stored usage events", async () => {
    for (const call of [sampleGoogleSearchCall("enterprise AI evidence records"), sampleGoogleSearchCall("sports betting picks tonight")]) {
      await fetch(`${baseUrl}/trace/ingest?mode=observe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_acme",
          project_id: "proj_ai_governance",
          user_id: "user_analytics",
          session_id: "sess_analytics",
          source: "api",
          call,
          response: sampleGoogleSearchResponse(String(call.arguments.query)),
        }),
      });
    }

    const response = await fetch(`${baseUrl}/trace/analytics?tenant_id=tenant_acme&project_id=proj_ai_governance`);
    const analytics = (await response.json()) as TraceAnalytics;

    expect(response.status).toBe(200);
    expect(analytics.total_events).toBe(2);
    expect(analytics.total_sessions).toBe(1);
    expect(analytics.intent_counts.business_sensitive_workflow).toBe(1);
    expect(analytics.risk_counts.low).toBe(1);
    expect(analytics.risk_counts.medium).toBe(1);
    expect(analytics.flagged_events).toBe(1);
    expect(analytics.response_events).toBe(2);
    expect(analytics.total_output_tokens).toBeGreaterThan(0);
    expect(analytics.improvement_opportunities).toContain("Clarify acceptable-use boundaries and show just-in-time guidance for out-of-domain prompts.");
    expect(analytics.recent_events[0].response_preview).toContain("AI overview");
    expect(analytics.recent_events).toHaveLength(2);
  });
});
