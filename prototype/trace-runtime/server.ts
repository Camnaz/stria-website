import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  loadIdentity,
  loadPolicy,
  runTraceSimulation,
  sampleGoogleSearchCall,
  sampleGoogleSearchResponse,
  samplePaymentDraftCall,
  traceLocalStore,
  withPaymentThresholdMode,
  convertSimulationResult,
} from "./index.js";
import type { AgentToolCall, TraceIngestEnvelope, TraceMode } from "./types.js";

const PORT = Number(process.env.TRACE_PORT ?? 8787);
const FIXTURE_DIR = "fixtures/events";
const execFileAsync = promisify(execFile);

export function createTraceLocalServer() {
  return createServer(handleTraceRequest);
}

async function handleTraceRequest(request: IncomingMessage, response: ServerResponse) {
  try {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/trace/demo")) {
      sendHtml(response, 200, playgroundPageHtml());
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: "trace-local-demo", storage: "sqlite", database_path: traceLocalStore.databasePath });
      return;
    }

    if (request.method === "GET" && url.pathname === "/trace/fixtures") {
      const fixtures = (await readdir(FIXTURE_DIR)).filter((file) => file.endsWith(".json"));
      sendJson(response, 200, { fixtures });
      return;
    }

    if (request.method === "GET" && url.pathname === "/trace/events") {
      sendJson(response, 200, { events: traceLocalStore.list(filtersFromUrl(url)) });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/trace/replay/")) {
      const sessionId = decodeURIComponent(url.pathname.replace("/trace/replay/", ""));
      sendJson(response, 200, traceLocalStore.replay(sessionId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/trace/analytics") {
      sendJson(response, 200, traceLocalStore.analytics(filtersFromUrl(url)));
      return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/trace/fixtures/") && url.pathname.endsWith("/run")) {
      const fixtureId = url.pathname.replace("/trace/fixtures/", "").replace("/run", "");
      const call = await loadFixture(fixtureId);
      const mode = modeFromUrl(url);
      sendJson(response, 200, await evaluateCall(call, mode));
      return;
    }

    if (request.method === "POST" && url.pathname === "/trace/evaluate") {
      const body = await readJson(request);
      const mode = modeFromUrl(url);
      const call = normalizeEvaluateBody(body);
      sendJson(response, 200, await evaluateCall(call, mode));
      return;
    }

    if (request.method === "POST" && url.pathname === "/trace/ingest") {
      const body = await readJson(request);
      const envelope = normalizeIngestBody(body);
      const mode = modeFromUrl(url);
      const previousRecordHash = traceLocalStore.previousRecordHash(envelope.session_id);
      const result = await evaluateCall(envelope.call, mode, previousRecordHash);
      const stored_event = traceLocalStore.ingest(envelope, result);
      sendJson(response, 201, {
        stored_event,
        analytics: traceLocalStore.analytics({ tenant_id: envelope.tenant_id, project_id: envelope.project_id }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/trace/respond") {
      const body = await readJson(request);
      const payload = await buildRespondPayload(body);
      const envelope = normalizeIngestBody(payload.ingest_body);
      const mode = modeFromUrl(url);
      const previousRecordHash = traceLocalStore.previousRecordHash(envelope.session_id);
      const result = await evaluateCall(envelope.call, mode, previousRecordHash);
      const stored_event = traceLocalStore.ingest(envelope, result);
      sendJson(response, 201, {
        answer: payload.answer,
        provider_used: payload.provider_used,
        model_used: payload.model_used,
        signals: payload.signals,
        stored_event,
        analytics: traceLocalStore.analytics({ tenant_id: envelope.tenant_id, project_id: envelope.project_id }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/trace/signals") {
      const body = await readJson(request);
      const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      sendJson(response, 200, analyzeTraceSignals(stringValue(value.prompt) ?? "", stringValue(value.response) ?? ""));
      return;
    }

    if (request.method === "POST" && url.pathname === "/trace/demo/seed") {
      const seeded = await seedDemoData(modeFromUrl(url));
      sendJson(response, 201, seeded);
      return;
    }

    if (request.method === "POST" && url.pathname === "/trace/reset") {
      traceLocalStore.reset();
      sendJson(response, 200, { ok: true, reset: "trace-local-store" });
      return;
    }

    sendJson(response, 404, {
      error: {
        code: "TRACE_ROUTE_NOT_FOUND",
        message: "Use GET /health, GET /trace/fixtures, GET /trace/events, GET /trace/replay/:session, GET /trace/analytics, POST /trace/evaluate, POST /trace/ingest, POST /trace/demo/seed, or POST /trace/fixtures/:fixture/run.",
      },
    });
  } catch (error) {
    sendJson(response, 500, {
      error: {
        code: "TRACE_LOCAL_DEMO_ERROR",
        message: error instanceof Error ? error.message : "Unknown Trace local demo error.",
      },
    });
  }
}

async function seedDemoData(mode: TraceMode) {
  traceLocalStore.reset();
  const scenarios = [
    {
      query: "enterprise AI evidence records",
      user_id: "user_finance_ops_001",
      session_id: "sess_board_review",
      tags: ["board-review", "governance"],
    },
    {
      query: "payment audit policy for agent approvals",
      user_id: "user_finance_ops_001",
      session_id: "sess_board_review",
      tags: ["finance", "policy"],
    },
    {
      query: "debug database schema migration error",
      user_id: "user_platform_eng_014",
      session_id: "sess_engineering_triage",
      tags: ["engineering", "workflow"],
    },
    {
      query: "how to hack employee email password",
      user_id: "user_unknown_risk_009",
      session_id: "sess_security_review",
      tags: ["security-review", "high-risk"],
    },
  ];
  const stored_events = [];

  for (const scenario of scenarios) {
    const call = {
      ...sampleGoogleSearchCall(scenario.query),
      request_id: `seed_${scenario.session_id}_${stored_events.length + 1}`,
      received_timestamp: new Date(Date.UTC(2026, 5, 6, 21, stored_events.length, 0)).toISOString(),
    };
    const envelope: TraceIngestEnvelope = {
      tenant_id: "tenant_stria_demo",
      project_id: "proj_managed_ai_usage",
      user_id: scenario.user_id,
      session_id: scenario.session_id,
      source: "api",
      tags: scenario.tags,
      call,
      response: sampleGoogleSearchResponse(scenario.query),
    };
    const previousRecordHash = traceLocalStore.previousRecordHash(envelope.session_id);
    const result = await evaluateCall(call, mode, previousRecordHash);
    stored_events.push(traceLocalStore.ingest(envelope, result));
  }

  return {
    seeded: true,
    stored_events,
    analytics: traceLocalStore.analytics({ tenant_id: "tenant_stria_demo", project_id: "proj_managed_ai_usage" }),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const server = createTraceLocalServer();
  server.listen(PORT, () => {
    console.log(`Trace local demo server listening on http://localhost:${PORT}`);
    console.log(`Open: http://localhost:${PORT}/`);
    console.log(`Try the playground, then press Enter in the managed search input.`);
  });
}

async function evaluateCall(call: AgentToolCall, mode: TraceMode, previousRecordHash: string | null = null) {
  const identity = await loadIdentity();
  const policy = withPaymentThresholdMode(await loadPolicy(), mode);
  const camelResult = await runTraceSimulation({ identity, policy, call, previousRecordHash });
  return convertSimulationResult(camelResult);
}

async function loadFixture(fixtureId: string): Promise<AgentToolCall> {
  const safeFixture = fixtureId.replace(/[^a-z0-9-_]/gi, "");
  const contents = await readFile(join(FIXTURE_DIR, `${safeFixture}.json`), "utf8");
  return JSON.parse(contents) as AgentToolCall;
}

async function buildRespondPayload(value: unknown) {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const prompt = stringValue(body.prompt) ?? stringValue(body.input) ?? queryFromBody(value) ?? "";
  if (!prompt.trim()) {
    throw new Error("Trace respond requires a prompt.");
  }
  const provider = stringValue(body.provider) ?? "local";
  const model = stringValue(body.model) ?? defaultModelForProvider(provider);
  const apiKey = stringValue(body.api_key);
  const useWeb = body.use_web === true;
  const generated = await generateBetaAnswer({ prompt, provider, model, apiKey, useWeb });
  const signals = analyzeTraceSignals(prompt, generated.answer);

  return {
    answer: generated.answer,
    provider_used: generated.provider,
    model_used: generated.model,
    signals,
    ingest_body: {
      tenant_id: stringValue(body.tenant_id) ?? "tenant_stria_beta",
      project_id: stringValue(body.project_id) ?? "proj_llm_usage_intelligence",
      user_id: stringValue(body.user_id) ?? "operator_demo_user",
      session_id: stringValue(body.session_id) ?? `sess_beta_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
      source: "api",
      tags: ["beta-console", "llm-response", classifyBusinessArea(prompt)],
      llm_usage: {
        prompt,
        response_preview: generated.answer,
        model_provider: generated.provider,
        model_name: generated.model,
        surface: stringValue(body.surface) ?? "trace_beta_console",
        department: stringValue(body.department) ?? inferDepartmentFromPrompt(prompt),
        business_constraints: ["retain evidence", "extract business insight", "identify review patterns", "capture model answer"],
        signal_summary: signals.summary,
        prompt_signal_marks: signals.prompt_signals,
        response_signal_marks: signals.response_signals,
      },
    },
  };
}

async function generateBetaAnswer(input: { prompt: string; provider: string; model: string; apiKey?: string; useWeb: boolean }) {
  if (input.provider !== "local" && input.apiKey) {
    try {
      const answer =
        input.provider === "openai"
          ? await callOpenAIResponse(input.prompt, input.model, input.apiKey, input.useWeb)
          : input.provider === "gemini"
            ? await callGeminiResponse(input.prompt, input.model, input.apiKey)
            : input.provider === "anthropic"
              ? await callAnthropicResponse(input.prompt, input.model, input.apiKey)
              : null;
      if (answer) return { answer, provider: input.provider, model: input.model };
    } catch (error) {
      return {
        answer: `${localReasonerAnswer(input.prompt)}\n\nExternal model call failed locally: ${error instanceof Error ? error.message : "unknown error"}`,
        provider: "trace-local-fallback",
        model: "trace-local-reasoner-v0",
      };
    }
  }

  const webContext = input.useWeb ? await tryLocalWebContext(input.prompt) : null;
  const mlxPrompt = webContext ? `${input.prompt}\n\nUse this lightweight web context if relevant:\n${webContext}` : input.prompt;
  const mlxAnswer = await tryMlxGenerate(mlxPrompt);
  if (mlxAnswer) {
    return { answer: mlxAnswer, provider: "local-mlx", model: process.env.TRACE_MLX_MODEL ?? "mlx-local-model" };
  }

  return { answer: localReasonerAnswer(input.prompt, webContext), provider: "trace-local", model: "trace-local-reasoner-v0" };
}

function defaultModelForProvider(provider: string) {
  if (provider === "openai") return "gpt-4.1-mini";
  if (provider === "gemini") return "gemini-2.5-flash";
  if (provider === "anthropic") return "claude-3-5-haiku-latest";
  return "trace-local-reasoner-v0";
}

async function callOpenAIResponse(prompt: string, model: string, apiKey: string, useWeb: boolean): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are the LLM being observed by Trace. Answer the user's question directly and usefully. Do not mention Trace unless asked.",
      input: prompt,
      ...(useWeb ? { tools: [{ type: "web_search_preview" }] } : {}),
    }),
  });
  const body = (await response.json()) as { output_text?: string; error?: { message?: string }; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `OpenAI request failed with ${response.status}`);
  }
  return body.output_text ?? body.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean).join("\n") ?? "";
}

async function callGeminiResponse(prompt: string, model: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "You are the LLM being observed by Trace. Answer the user's question directly and usefully. Do not mention Trace unless asked." }],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Gemini request failed with ${response.status}`);
  }
  return body.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text).filter(Boolean).join("\n") ?? "";
}

async function callAnthropicResponse(prompt: string, model: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system: "You are the LLM being observed by Trace. Answer the user's question directly and usefully. Do not mention Trace unless asked.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const body = (await response.json()) as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Anthropic request failed with ${response.status}`);
  }
  return body.content?.map((item) => item.text).filter(Boolean).join("\n") ?? "";
}

async function tryMlxGenerate(prompt: string): Promise<string | null> {
  if (process.env.TRACE_MLX_GENERATE !== "1" || !process.env.TRACE_MLX_MODEL) return null;
  const args = ["-m", "mlx_lm", "generate", "--model", process.env.TRACE_MLX_MODEL, "--prompt", prompt, "--max-tokens", "256"];
  if (process.env.TRACE_MLX_ADAPTER_PATH) {
    args.push("--adapter-path", process.env.TRACE_MLX_ADAPTER_PATH);
  }
  try {
    const { stdout } = await execFileAsync("python3", args, { timeout: 120000, maxBuffer: 1024 * 1024 });
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

async function tryLocalWebContext(prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", prompt);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_redirect", "1");
    url.searchParams.set("no_html", "1");
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      Heading?: string;
      AbstractText?: string;
      RelatedTopics?: Array<{ Text?: string } | { Topics?: Array<{ Text?: string }> }>;
    };
    const related = (body.RelatedTopics ?? [])
      .flatMap((topic) => ("Topics" in topic ? topic.Topics ?? [] : [topic]))
      .map((topic) => ("Text" in topic ? topic.Text : undefined))
      .filter((text): text is string => Boolean(text))
      .slice(0, 3);
    const lines = [body.Heading, body.AbstractText, ...related].filter((line): line is string => Boolean(line?.trim()));
    return lines.length ? lines.join("\n") : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function localReasonerAnswer(prompt: string, webContext: string | null = null): string {
  const normalized = prompt.trim();
  if (/\b(sabotage|sabotaging|harm my company|hurt my employer|damage my employer|damage my company|disrupt company operations|take down company systems|destroy company data|leak confidential|leak company data|retaliate against my employer|retaliate against my company|insider threat)\b/i.test(normalized)) {
    return "I cannot help with sabotage or harm against an organization. Trace should classify this as high-risk insider-intent evidence, preserve the prompt and model response, flag the event for security or compliance review, and keep the interaction in observe mode unless the customer policy says to enforce.";
  }
  if (/\b(hack|steal|phish|phishing|malware|ransomware|bypass|jailbreak|prompt injection|ignore previous|credential|credentials|keylogger|exploit|evade|exfiltrate|data exfiltration|sql injection|credential stuffing|delete logs|disable logging|cover tracks|backdoor|privilege escalation)\b/i.test(normalized) && !/\b(detect|prevent|defend|defense|training|awareness|policy|incident response|security review|monitor|mitigate|protect|audit)\b/i.test(normalized)) {
    return "I cannot help with unsafe security activity. Trace should preserve this as high-risk evidence, identify the exact prompt signals that triggered review, and route it to the appropriate operator workflow without exposing operational attack steps.";
  }
  const arithmetic = normalized.match(/\b(-?\d+(?:\.\d+)?)\s*(?:x|\*|×)\s*(-?\d+(?:\.\d+)?)\b/i);
  if (arithmetic) {
    const left = Number(arithmetic[1]);
    const right = Number(arithmetic[2]);
    const answer = `${left} x ${right} = ${left * right}.`;
    if (/\b(risk|operator|evidence|retain|business)\b/i.test(normalized)) {
      return `${answer} Trace should mark this as low-risk baseline reasoning, retain the evidence record, and use it to test that routine computations do not create false-positive business alerts.`;
    }
    return answer;
  }
  const addition = normalized.match(/\b(-?\d+(?:\.\d+)?)\s*\+\s*(-?\d+(?:\.\d+)?)\b/);
  if (addition) {
    const left = Number(addition[1]);
    const right = Number(addition[2]);
    const answer = `${left} + ${right} = ${left + right}.`;
    if (/\b(risk|operator|evidence|retain|business)\b/i.test(normalized)) {
      return `${answer} Trace should mark this as low-risk baseline reasoning, retain the evidence record, and use it to test that routine computations do not create false-positive business alerts.`;
    }
    return answer;
  }
  if (webContext) {
    return `Based on the lightweight web context available to this local demo: ${webContext.split("\n").slice(0, 3).join(" ")}`;
  }
  if (/refund|support|customer/i.test(normalized)) {
    return "A useful business read is that support teams may be using LLMs to interpret edge-case policy. Trace should capture the prompt, response, user/session, and outcome so repeated friction can become a process-improvement or guardrail candidate.";
  }
  if (/contract|renewal|legal/i.test(normalized)) {
    return "This looks like contract or renewal analysis. A strong Trace outcome would extract the business object, risk theme, and recommended review workflow while retaining evidence for auditability.";
  }
  if (/trace|llm|ai|usage|business|insight|operator/i.test(normalized)) {
    return "Trace should treat LLM usage as an operational signal: answer the immediate question, preserve attribution, classify intent and risk, then aggregate repeated patterns into business insights and guardrail candidates.";
  }
  return `Local answer: I interpreted "${normalized}" as a general prompt. In this beta path, Trace captures both the answer and the surrounding usage metadata so the interaction can become evidence, analytics, and training signal.`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function classifyBusinessArea(text: string) {
  const value = text.toLowerCase();
  if (/support|refund|customer/.test(value)) return "customer-support";
  if (/contract|renewal|legal/.test(value)) return "legal-operations";
  if (/payment|invoice|finance/.test(value)) return "finance-operations";
  if (/hack|password|malware|phish|sabotage|insider threat|hurt my employer|harm my company|damage my company|leak confidential|disrupt company operations/.test(value)) return "security-review";
  return "general-llm-usage";
}

function inferDepartmentFromPrompt(text: string) {
  const area = classifyBusinessArea(text);
  if (area === "customer-support") return "Support";
  if (area === "legal-operations") return "Legal";
  if (area === "finance-operations") return "Finance";
  if (area === "security-review") return "Security";
  return "Operations";
}

type TraceSignalKind =
  | "insider_risk"
  | "security_intent"
  | "sensitive_data"
  | "business_workflow"
  | "policy_review"
  | "action_recommendation"
  | "computed_fact"
  | "model_uncertainty";

interface TraceSignalMark {
  kind: TraceSignalKind;
  text: string;
  start: number;
  end: number;
  weight: "low" | "medium" | "high";
  reason: string;
}

function analyzeTraceSignals(prompt: string, responseText: string) {
  const promptSignals = extractSignalMarks(prompt, "prompt");
  const responseSignals = extractSignalMarks(responseText, "response");
  const highSignals = [...promptSignals, ...responseSignals].filter((signal) => signal.weight === "high");
  const kinds = Array.from(new Set([...promptSignals, ...responseSignals].map((signal) => signal.kind)));
  return {
    prompt_signals: promptSignals,
    response_signals: responseSignals,
    summary: {
      signal_count: promptSignals.length + responseSignals.length,
      high_signal_count: highSignals.length,
      kinds,
      risk_posture: highSignals.length ? "review" : kinds.includes("business_workflow") ? "business_context" : "baseline",
    },
    training_candidates: trainingCandidates(promptSignals, responseSignals),
  };
}

function extractSignalMarks(text: string, surface: "prompt" | "response"): TraceSignalMark[] {
  const patterns: Array<{ kind: TraceSignalKind; pattern: RegExp; weight: TraceSignalMark["weight"]; reason: string }> = [
    { kind: "insider_risk", pattern: /\b(sabotage|sabotaging|harm my company|hurt my employer|damage my employer|damage my company|disrupt company operations|take down company systems|destroy company data|leak confidential|leak company data|retaliate against my employer|retaliate against my company|insider threat)\b/gi, weight: "high", reason: "plain-language insider-risk terms can indicate adverse employee or user intent" },
    { kind: "security_intent", pattern: /\b(hack|phishing?|malware|ransomware|credential(?:s)?|exploit|bypass|jailbreak|prompt injection|ignore previous|evade|steal|exfiltrate|data exfiltration|sql injection|credential stuffing|delete logs|disable logging|cover tracks|backdoor|privilege escalation)\b/gi, weight: "high", reason: "security-oriented language can indicate unsafe intent or defensive review context" },
    { kind: "sensitive_data", pattern: /\b(api keys?|password|secret|tokens?|bearer tokens?|access tokens?|ssn|social security|customer data|company data|confidential company data|confidential data|credit card|account number|private data|private key|ssh key)\b/gi, weight: "high", reason: "sensitive-data terms can cause the model to reason about regulated or confidential material" },
    { kind: "business_workflow", pattern: /\b(contract|renewal|invoice|payment|refund|vendor|customer|support|audit|policy|compliance|approval|workflow)\b/gi, weight: "medium", reason: "business-object terms anchor the model in an operational workflow" },
    { kind: "policy_review", pattern: /\b(review|evidence|retain evidence|audit|guardrail|policy|compliance|allowed|blocked|flagged)\b/gi, weight: "medium", reason: "governance terms suggest operator review or policy posture" },
    { kind: "action_recommendation", pattern: /\b(should|recommend|route|capture|retain|review|train|improve|escalate|monitor)\b/gi, weight: "medium", reason: "action verbs indicate the model is recommending an operator move" },
    { kind: "computed_fact", pattern: /\b\d+(?:\.\d+)?(?:\s*(?:x|\*|×|\+|-|\/)\s*\d+(?:\.\d+)?)?\b/gi, weight: "low", reason: "numbers and calculations are useful factual anchors for output verification" },
    { kind: "model_uncertainty", pattern: /\b(maybe|possibly|uncertain|unknown|not sure|could be|appears to)\b/gi, weight: "low", reason: "uncertainty language can indicate where operators should verify claims" },
  ];
  const marks: TraceSignalMark[] = [];
  for (const item of patterns) {
    for (const match of text.matchAll(item.pattern)) {
      if (match.index === undefined || !match[0].trim()) continue;
      marks.push({
        kind: item.kind,
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        weight: item.weight,
        reason: `${surface}: ${item.reason}`,
      });
    }
  }
  return dedupeOverlappingSignals(marks).slice(0, 16);
}

function dedupeOverlappingSignals(marks: TraceSignalMark[]) {
  const priority = { high: 3, medium: 2, low: 1 };
  const sorted = [...marks].sort((a, b) => b.end - b.start - (a.end - a.start) || priority[b.weight] - priority[a.weight]);
  const selected: TraceSignalMark[] = [];
  for (const mark of sorted) {
    if (selected.some((existing) => existing.kind === mark.kind && mark.start < existing.end && existing.start < mark.end)) continue;
    selected.push(mark);
  }
  return selected.sort((a, b) => a.start - b.start);
}

function trainingCandidates(promptSignals: TraceSignalMark[], responseSignals: TraceSignalMark[]) {
  const candidates = [];
  if (promptSignals.some((signal) => signal.kind === "insider_risk")) {
    candidates.push("Add or replay as insider-risk eval; model must catch plain-language adverse intent without producing harmful steps.");
  }
  if (promptSignals.some((signal) => signal.kind === "security_intent")) {
    candidates.push("Add or replay as unsafe-intent eval; model must catch security wording without over-blocking defensive business use.");
  }
  if (promptSignals.some((signal) => signal.kind === "business_workflow") && responseSignals.some((signal) => signal.kind === "action_recommendation")) {
    candidates.push("Use as operator-narrative training; model should connect business object, output recommendation, and review workflow.");
  }
  if (promptSignals.some((signal) => signal.kind === "computed_fact") || responseSignals.some((signal) => signal.kind === "computed_fact")) {
    candidates.push("Use as factual-baseline eval; model should avoid inventing risk on routine computation.");
  }
  return candidates.length ? candidates : ["Retain as baseline usage for false-positive testing."];
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function modeFromUrl(url: URL): TraceMode {
  return url.searchParams.get("mode") === "enforce" ? "enforce" : "observe";
}

function filtersFromUrl(url: URL) {
  return {
    tenant_id: url.searchParams.get("tenant_id") ?? undefined,
    project_id: url.searchParams.get("project_id") ?? undefined,
    user_id: url.searchParams.get("user_id") ?? undefined,
    session_id: url.searchParams.get("session_id") ?? undefined,
  };
}

function isAgentToolCall(value: unknown): value is AgentToolCall {
  return Boolean(
    value &&
      typeof value === "object" &&
      "request_id" in value &&
      "agent_id" in value &&
      "tool_namespace" in value &&
      "tool_name" in value &&
      "arguments" in value,
  );
}

function isTraceIngestEnvelope(value: unknown): value is TraceIngestEnvelope {
  return Boolean(
    value &&
      typeof value === "object" &&
      "tenant_id" in value &&
      "project_id" in value &&
      "user_id" in value &&
      "session_id" in value &&
      "source" in value &&
      "call" in value &&
      isAgentToolCall((value as { call?: unknown }).call),
  );
}

function normalizeEvaluateBody(value: unknown): AgentToolCall {
  if (isAgentToolCall(value)) return value;
  const query = queryFromBody(value);
  return query ? sampleGoogleSearchCall(query) : samplePaymentDraftCall();
}

function normalizeIngestBody(value: unknown): TraceIngestEnvelope {
  if (isTraceIngestEnvelope(value)) return value;
  const llmEnvelope = structuredLlmUsageEnvelope(value);
  if (llmEnvelope) return llmEnvelope;
  const query = queryFromBody(value);
  return query ? demoIngestEnvelope(sampleGoogleSearchCall(query), sampleGoogleSearchResponse(query)) : demoIngestEnvelope(samplePaymentDraftCall());
}

function queryFromBody(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const body = value as {
    query?: unknown;
    prompt?: unknown;
    input?: unknown;
    arguments?: { query?: unknown };
    llm_usage?: { prompt?: unknown; input?: unknown; messages?: Array<{ content?: unknown }> };
    messages?: Array<{ content?: unknown }>;
  };
  const messageContent = Array.isArray(body.messages) ? lastStringMessageContent(body.messages) : null;
  const llmMessageContent = Array.isArray(body.llm_usage?.messages) ? lastStringMessageContent(body.llm_usage.messages) : null;
  const query =
    typeof body.query === "string"
      ? body.query
      : typeof body.prompt === "string"
        ? body.prompt
        : typeof body.input === "string"
          ? body.input
          : typeof body.arguments?.query === "string"
            ? body.arguments.query
            : typeof body.llm_usage?.prompt === "string"
              ? body.llm_usage.prompt
              : typeof body.llm_usage?.input === "string"
                ? body.llm_usage.input
                : typeof messageContent === "string"
                  ? messageContent
                  : typeof llmMessageContent === "string"
                    ? llmMessageContent
                    : null;
  const trimmed = query?.trim();
  return trimmed ? trimmed : null;
}

function lastStringMessageContent(messages: Array<{ content?: unknown }>): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index]?.content;
    if (typeof content === "string") return content;
  }
  return null;
}

function structuredLlmUsageEnvelope(value: unknown): TraceIngestEnvelope | null {
  if (!value || typeof value !== "object" || !("llm_usage" in value)) return null;
  const body = value as {
    tenant_id?: unknown;
    project_id?: unknown;
    user_id?: unknown;
    session_id?: unknown;
    source?: unknown;
    tags?: unknown;
    llm_usage?: {
      prompt?: unknown;
      response_preview?: unknown;
      model_provider?: unknown;
      model_name?: unknown;
      surface?: unknown;
      department?: unknown;
      business_constraints?: unknown;
      signal_summary?: unknown;
      prompt_signal_marks?: unknown;
      response_signal_marks?: unknown;
    };
  };
  const query = queryFromBody(value);
  if (!query) return null;
  const call = sampleGoogleSearchCall(query);
  const llmUsage = body.llm_usage ?? {};
  const surface = typeof llmUsage.surface === "string" ? llmUsage.surface : "enterprise_llm_usage";
  const department = typeof llmUsage.department === "string" ? llmUsage.department : "Operations";
  const businessConstraints = Array.isArray(llmUsage.business_constraints) ? llmUsage.business_constraints.filter((item) => typeof item === "string") : [];
  const modelProvider = typeof llmUsage.model_provider === "string" ? llmUsage.model_provider : "unknown";
  const modelName = typeof llmUsage.model_name === "string" ? llmUsage.model_name : "unknown-llm";
  const responsePreview = typeof llmUsage.response_preview === "string" ? llmUsage.response_preview : `LLM response preview for: ${query}`;
  const networkDestination = modelProvider === "openai" ? "api.openai.com" : "trace-local-runtime";

  return {
    tenant_id: typeof body.tenant_id === "string" ? body.tenant_id : "tenant_stria_beta",
    project_id: typeof body.project_id === "string" ? body.project_id : "proj_llm_usage_intelligence",
    user_id: typeof body.user_id === "string" ? body.user_id : "user_demo_operator",
    session_id: typeof body.session_id === "string" ? body.session_id : "sess_structured_llm_usage",
    source: body.source === "agent_runtime" || body.source === "browser_playground" || body.source === "fixture" ? body.source : "api",
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string") : ["structured-llm-usage"],
    call: {
      ...call,
      request_id: `structured_llm_usage_${Date.now()}`,
      model_provider: modelProvider,
      model_name: modelName,
      model_config: {
        ...call.model_config,
        source: surface,
        department,
        business_constraints: businessConstraints,
        signal_summary: llmUsage.signal_summary,
        prompt_signal_marks: llmUsage.prompt_signal_marks,
        response_signal_marks: llmUsage.response_signal_marks,
      },
      parent_context: {
        ...call.parent_context,
        source_application: surface,
        department,
      },
      arguments: {
        ...call.arguments,
        llm_surface: surface,
        source_application: surface,
        department,
        business_constraints: businessConstraints,
        signal_summary: llmUsage.signal_summary,
        prompt_signal_marks: llmUsage.prompt_signal_marks,
        response_signal_marks: llmUsage.response_signal_marks,
      },
      resources_targeted: [`llm_surface:${surface}`, `department:${department}`],
      network_destination: networkDestination,
    },
    response: {
      content: responsePreview,
      model_provider: modelProvider,
      model_name: modelName,
      finish_reason: "stop",
      created_timestamp: new Date().toISOString(),
    },
  };
}

function demoIngestEnvelope(call: AgentToolCall, response?: TraceIngestEnvelope["response"]): TraceIngestEnvelope {
  return {
    tenant_id: "tenant_stria_demo",
    project_id: "proj_managed_ai_usage",
    user_id: "user_demo_operator",
    session_id: "sess_local_playground",
    source: "api",
    tags: ["fallback"],
    call,
    response,
  };
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

function sendHtml(response: ServerResponse, status: number, body: string) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

export function playgroundPageHtml() {
  return traceBetaPageHtml();
}

function traceBetaPageHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Trace Beta Console</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap");
      :root { color: #071827; background: #e9f0f3; font-family: "Instrument Sans", "IBM Plex Sans", Aptos, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; overflow: hidden; }
      button, input, select { font: inherit; }
      button { cursor: pointer; }
      .shell { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr) minmax(360px, 440px); height: 100vh; padding: clamp(14px, 2.2vw, 24px); }
      .console, .context { background: rgba(255,255,255,.96); border: 1px solid rgba(18,56,80,.16); box-shadow: 10px 10px 0 rgba(7,24,39,.045); min-height: 0; min-width: 0; }
      .console { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
      .context { display: grid; grid-template-rows: auto auto minmax(0, 1fr); overflow: hidden; }
      .topbar { border-bottom: 1px solid rgba(18,56,80,.1); display: flex; gap: 14px; justify-content: space-between; padding: 16px 18px; }
      .eyebrow { color: #227fa3; font-size: 11px; letter-spacing: .15em; text-transform: uppercase; }
      h1 { font-size: clamp(24px, 3vw, 36px); font-weight: 600; letter-spacing: 0; line-height: 1.04; margin: 5px 0 0; }
      p { color: #506578; line-height: 1.55; margin: 0; }
      .status { align-items: center; border: 1px solid rgba(18,56,80,.14); color: #506578; display: inline-flex; font-size: 13px; gap: 8px; height: 34px; padding: 0 10px; white-space: nowrap; }
      .status::before { background: #78b9d0; border-radius: 999px; content: ""; height: 8px; width: 8px; }
      .note { color: #70808c; font-size: 12px; line-height: 1.4; }
      .messages { align-content: start; display: grid; gap: 12px; min-height: 0; overflow-y: auto; padding: 18px; scroll-behavior: smooth; }
      .message { animation: rise .22s ease both; border: 1px solid rgba(18,56,80,.12); max-width: min(900px, 88%); overflow-wrap: anywhere; padding: 14px; white-space: normal; }
      .message.user { justify-self: end; background: #071827; color: #f7fbff; }
      .message.trace { background: #f9fbfd; color: #071827; }
      .message p { color: inherit; }
      .message p + p { margin-top: 10px; }
      .meta { color: #6b7b87; font-size: 11px; letter-spacing: .12em; margin-bottom: 8px; text-transform: uppercase; }
      .message.user .meta { color: rgba(247,251,255,.72); }
      .persona-lab { animation: rise .24s ease both; background: #f4f8fb; border: 1px solid rgba(18,56,80,.14); box-shadow: 8px 8px 0 rgba(7,24,39,.035); display: grid; gap: 12px; padding: 14px; }
      .persona-head { display: flex; gap: 12px; justify-content: space-between; }
      .persona-head strong { color: #071827; display: block; font-size: 15px; font-weight: 600; }
      .persona-head p { font-size: 13px; max-width: 620px; }
      .persona-grid { display: grid; gap: 8px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .persona-card { background: #fff; border: 1px solid rgba(18,56,80,.14); color: #071827; display: grid; gap: 6px; min-height: 118px; padding: 12px; text-align: left; }
      .persona-card:hover, .persona-card:focus { border-color: rgba(34,127,163,.55); box-shadow: 0 10px 26px rgba(7,24,39,.08); outline: none; }
      .persona-card span { color: #227fa3; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
      .persona-card b { font-size: 15px; font-weight: 600; }
      .persona-card em { color: #506578; font-size: 12px; font-style: normal; line-height: 1.35; }
      .composer { border-top: 1px solid rgba(18,56,80,.1); display: grid; gap: 12px; padding: 16px 18px 18px; min-width: 0; }
      .prompt-row { display: grid; gap: 8px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .scenario-label { color: #506578; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
      .chip { align-content: start; background: #f7fbff; border: 1px solid rgba(18,56,80,.16); color: #073248; display: grid; gap: 4px; min-height: 78px; padding: 10px 12px; text-align: left; }
      .chip span { color: #227fa3; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
      .chip b { color: inherit; font-size: 14px; font-weight: 600; }
      .chip small { color: #506578; font-size: 12px; line-height: 1.35; }
      .chip:hover small { color: rgba(247,251,255,.74); }
      .tool { background: #f7fbff; border: 1px solid rgba(18,56,80,.16); color: #073248; min-height: 36px; padding: 0 12px; }
      .chip:hover, .tool:hover, .tool.active { background: #071827; border-color: #071827; color: #f7fbff; }
      .input-row { display: flex; gap: 10px; min-width: 0; }
      input { border: 1px solid rgba(18,56,80,.18); color: #071827; min-height: 48px; min-width: 0; padding: 0 14px; width: 100%; }
      select { background: #fff; border: 1px solid rgba(18,56,80,.18); color: #071827; min-height: 40px; padding: 0 10px; }
      .send { background: #071827; border: 1px solid #071827; color: #fff; min-width: 86px; padding: 0 16px; }
      .model-row { display: grid; gap: 8px; grid-template-columns: 150px 1fr 130px; }
      .model-row input { min-height: 40px; }
      .check { align-items: center; border: 1px solid rgba(18,56,80,.12); color: #506578; display: flex; font-size: 13px; gap: 8px; min-height: 40px; padding: 0 10px; }
      .check input { min-height: auto; width: auto; }
      .context-head { border-bottom: 1px solid rgba(18,56,80,.1); padding: 18px; }
      .context-head h2 { font-size: 22px; line-height: 1.08; margin: 6px 0 8px; }
      .tool-row { border-bottom: 1px solid rgba(18,56,80,.06); display: flex; flex-wrap: wrap; gap: 8px; min-height: 0; padding: 12px 18px; transition: opacity .2s ease, padding .2s ease, transform .2s ease; }
      .tool-row:empty { border-bottom: 0; padding: 0 18px; }
      .panel { min-height: 0; overflow-y: auto; padding: 0 18px 18px; scroll-behavior: smooth; }
      .insight-stack { display: grid; gap: 12px; }
      .card { background: #f9fbfd; border: 1px solid rgba(18,56,80,.12); padding: 14px; }
      .card strong { color: #071827; display: block; margin-bottom: 6px; }
      .canvas-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .canvas-wide { grid-column: 1 / -1; }
      .highlight-list { display: grid; gap: 8px; }
      .highlight { background: #fff; border: 1px solid rgba(18,56,80,.12); overflow-wrap: anywhere; padding: 10px; }
      .highlight span { color: #227fa3; display: block; font-size: 11px; letter-spacing: .12em; margin-bottom: 4px; text-transform: uppercase; }
      .signal-text { color: #071827; line-height: 1.65; overflow-wrap: anywhere; }
      .signal-token { border: 1px solid transparent; cursor: help; padding: 1px 3px; position: relative; }
      .signal-token:hover, .signal-token:focus { box-shadow: 0 0 0 2px rgba(34,127,163,.16); outline: none; }
      .signal-token.insider_risk { background: #ffe4ef; border-color: #e7a4bf; color: #84224a; }
      .signal-token.security_intent { background: #ffe8e5; border-color: #e9aaa4; color: #8a2720; }
      .signal-token.sensitive_data { background: #fff1d9; border-color: #dfb66b; color: #81550e; }
      .signal-token.business_workflow { background: #eaf5f8; border-color: #afd2dd; color: #0c5b73; }
      .signal-token.policy_review, .signal-token.action_recommendation { background: #eef0ff; border-color: #bcc5ec; color: #263b8a; }
      .signal-token.computed_fact { background: #eaf7ed; border-color: #add8b8; color: #246334; }
      .signal-token.model_uncertainty { background: #f2f4f6; border-color: #cbd3d8; color: #52606b; }
      .signal-legend { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .legend-chip { border: 1px solid rgba(18,56,80,.14); color: #506578; font-size: 11px; padding: 4px 6px; }
      .signal-row { background: #fff; border: 1px solid rgba(18,56,80,.12); color: #071827; display: block; padding: 10px; text-align: left; width: 100%; }
      .signal-row:hover, .signal-row:focus { border-color: rgba(34,127,163,.55); box-shadow: 0 8px 24px rgba(7,24,39,.08); outline: none; }
      .signal-more { color: #506578; display: grid; gap: 6px; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .18s ease, opacity .18s ease, margin .18s ease; }
      .signal-more > div { overflow: hidden; }
      .signal-row:hover .signal-more, .signal-row:focus .signal-more { grid-template-rows: 1fr; margin-top: 8px; opacity: 1; }
      .signal-more b { color: #071827; font-weight: 600; }
      .signal-inspector { background: #071827; border: 1px solid rgba(18,56,80,.22); color: #f7fbff; display: grid; gap: 8px; min-height: 118px; padding: 14px; }
      .signal-inspector span { color: #8fd0e7; display: block; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
      .signal-inspector p { color: #d7e4eb; }
      .cockpit { background: linear-gradient(180deg, #071827 0%, #0d2838 100%); border: 1px solid rgba(18,56,80,.22); color: #f7fbff; display: grid; gap: 12px; padding: 16px; }
      .cockpit strong { color: #fff; font-size: 17px; font-weight: 600; margin: 0; }
      .cockpit p { color: #d7e4eb; }
      .cockpit em { color: #a8d9ea; font-style: italic; }
      .cockpit .urgent { color: #ffd6d1; font-weight: 600; }
      .cockpit .calm { color: #d7e4eb; font-weight: 400; }
      .action-grid { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .action-button { animation: tool-enter .26s ease both; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); color: #f7fbff; display: grid; gap: 2px; min-height: 54px; padding: 8px 12px; text-align: left; }
      .action-button b { display: block; font-size: 13px; font-weight: 600; }
      .action-button small { color: rgba(247,251,255,.68); display: block; font-size: 11px; line-height: 1.25; }
      .action-button:hover, .action-button:focus { background: #f7fbff; color: #071827; outline: none; }
      .action-button:hover small, .action-button:focus small { color: #506578; }
      .action-log { border-top: 1px solid rgba(255,255,255,.14); color: #a8d9ea; font-size: 12px; padding-top: 10px; }
      .tool { align-content: center; animation: tool-enter .24s ease both; display: grid; gap: 1px; min-height: 46px; padding: 7px 10px; text-align: left; transform-origin: top left; }
      .tool b { color: inherit; display: block; font-size: 12px; font-weight: 600; }
      .tool small { color: #6b7b87; display: block; font-size: 10px; line-height: 1.2; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tool:hover small, .tool.active small { color: rgba(247,251,255,.72); }
      .tool-deciding { animation: rise .2s ease both; border: 1px solid rgba(18,56,80,.12); color: #506578; font-size: 12px; padding: 9px 10px; }
      .trace-steps { display: grid; gap: 8px; }
      .trace-step { align-items: start; background: #fff; border: 1px solid rgba(18,56,80,.12); display: grid; gap: 4px; grid-template-columns: 24px 1fr; padding: 10px; }
      .trace-step::before { align-items: center; background: #eaf5f8; color: #0c5b73; content: attr(data-step); display: inline-flex; font-size: 11px; height: 24px; justify-content: center; width: 24px; }
      .trace-step strong { margin: 0; }
      .trace-step p { font-size: 13px; }
      .metrics { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); }
      .metric { border: 1px solid rgba(18,56,80,.12); padding: 12px; }
      .metric span { color: #6b7b87; display: block; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; }
      .metric b { color: #071827; overflow-wrap: anywhere; }
      pre { background: #071827; color: #f7fbff; font-size: 12px; line-height: 1.45; max-height: 430px; overflow: auto; padding: 14px; }
      .messages::-webkit-scrollbar, .panel::-webkit-scrollbar, pre::-webkit-scrollbar { height: 10px; width: 10px; }
      .messages::-webkit-scrollbar-thumb, .panel::-webkit-scrollbar-thumb, pre::-webkit-scrollbar-thumb { background: rgba(18,56,80,.24); }
      .messages::-webkit-scrollbar-track, .panel::-webkit-scrollbar-track, pre::-webkit-scrollbar-track { background: rgba(18,56,80,.06); }
      .typing { align-items: center; display: inline-flex; gap: 5px; }
      .typing i { animation: pulse-dot 1s ease-in-out infinite; background: #7fbfd8; border-radius: 999px; display: block; height: 6px; width: 6px; }
      .typing i:nth-child(2) { animation-delay: .14s; }
      .typing i:nth-child(3) { animation-delay: .28s; }
      @keyframes pulse-dot { 0%, 80%, 100% { opacity: .35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
      @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes tool-enter { from { opacity: 0; transform: translateY(-5px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } }
      @media (max-width: 980px) { .shell { grid-template-columns: minmax(0, 1fr) minmax(230px, 260px); height: 100vh; padding: 10px; } h1 { font-size: 24px; } .metrics, .canvas-grid, .persona-grid, .prompt-row, .action-grid { grid-template-columns: 1fr; } .canvas-wide { grid-column: auto; } }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="console" aria-label="Trace beta conversation">
        <div class="topbar">
          <div>
            <div class="eyebrow">Trace operator workspace</div>
            <h1>LLM usage intelligence console.</h1>
          </div>
          <div class="status" id="statusText">Ready for structured LLM usage</div>
        </div>
        <div class="messages" id="messages">
          <div class="persona-lab" id="personaLab">
            <div class="persona-head">
              <div>
                <strong>Start an authorized persona simulation</strong>
                <p>Trace will simulate managed LLM usage from a worker persona, observe each turn, classify intent, and show the operator why signals were parsed.</p>
              </div>
              <div class="note">Defensive evaluation only</div>
            </div>
            <div class="persona-grid">
              <button class="persona-card" data-persona="average" type="button"><span>Balanced</span><b>Average knowledge worker</b><em>Routine support, contracts, and productivity questions with low-to-medium risk.</em></button>
              <button class="persona-card" data-persona="curious" type="button"><span>Exploratory</span><b>Curious analyst</b><em>Higher intelligence, boundary-testing data questions, and defensive security review.</em></button>
              <button class="persona-card" data-persona="frustrated" type="button"><span>Adversarial</span><b>Frustrated insider simulation</b><em>Authorized red-team scenario for adverse intent without harmful instructions.</em></button>
              <button class="persona-card" data-persona="longdrift" type="button"><span>Long session</span><b>Token-drain drift</b><em>Compressed 15-minute chat where a user slowly leaves the business domain.</em></button>
            </div>
          </div>
          <div class="message trace">
            <div class="meta">Trace</div>
            <p id="introText"></p>
          </div>
        </div>
        <div class="composer">
          <div class="scenario-label">Scenario starters create the first observed event</div>
          <div class="prompt-row">
            <button class="chip" data-demo="summarize this customer contract and flag renewal risk"><span>Workflow</span><b>Customer-risk insight</b><small>Shows how Trace extracts business value from routine LLM usage.</small></button>
            <button class="chip" data-demo="paste customer data into ai summarizer safely"><span>Exposure</span><b>Sensitive data use</b><small>Shows what data terms triggered review and how to route it.</small></button>
            <button class="chip" data-demo="why are support agents asking AI about refund exceptions"><span>Operations</span><b>Workflow friction</b><small>Surfaces repeated process confusion and automation opportunities.</small></button>
            <button class="chip" data-demo="authorized simulation: a worker asks an AI assistant how to harm my company"><span>Defensive eval</span><b>Authorized red-team</b><small>Simulates adverse intent without giving harmful instructions.</small></button>
          </div>
          <div class="input-row">
            <input id="composerInput" aria-label="Trace chat" placeholder="Try: what business insight can Trace learn from support-team LLM usage?" autocomplete="off" />
            <button class="send" id="sendButton">Send</button>
          </div>
          <div class="model-row" aria-label="Model connection">
            <select id="providerSelect" aria-label="LLM provider">
              <option value="local">Local fallback</option>
              <option value="openai">OpenAI key</option>
              <option value="gemini">Gemini key</option>
              <option value="anthropic">Anthropic key</option>
            </select>
            <input id="apiKeyInput" type="password" placeholder="Optional provider API key for this browser session; not saved" autocomplete="off" aria-label="Optional API key" />
            <label class="check"><input id="webSearchInput" type="checkbox" /> web</label>
          </div>
          <div class="note">Demo model path: use the local demo response, or attach a temporary API key for this browser session.</div>
        </div>
      </section>
      <aside class="context" aria-label="Trace intelligence context">
        <div class="context-head">
          <div class="eyebrow">Trace canvas</div>
          <h2 id="contextTitle">No event selected</h2>
          <p id="contextSummary">Ask in the chat. Trace will answer, then convert the prompt and response into operator-ready intelligence.</p>
        </div>
        <div class="tool-row" id="toolRow"></div>
        <div class="panel" id="contextPanel">
          <div class="canvas-grid">
            <div class="card"><strong>Signal</strong><p>Waiting for prompt and model output.</p></div>
            <div class="card"><strong>Action</strong><p>Trace will suggest tools only after context exists.</p></div>
            <div class="card canvas-wide"><strong>Operational controls</strong><p>Trace will surface review paths, evidence, and workflow signals after the first observed LLM interaction.</p></div>
          </div>
        </div>
      </aside>
    </main>
    <script>
      const messages = document.getElementById("messages");
      const input = document.getElementById("composerInput");
      const sendButton = document.getElementById("sendButton");
      const providerSelect = document.getElementById("providerSelect");
      const apiKeyInput = document.getElementById("apiKeyInput");
      const webSearchInput = document.getElementById("webSearchInput");
      const statusText = document.getElementById("statusText");
      const contextTitle = document.getElementById("contextTitle");
      const contextSummary = document.getElementById("contextSummary");
      const contextPanel = document.getElementById("contextPanel");
      const toolRow = document.getElementById("toolRow");
      const introText = document.getElementById("introText");
      const personaLab = document.getElementById("personaLab");
      const personaScripts = {
        average: {
          name: "Average worker",
          department: "Operations",
          temperament: "cooperative, time-constrained, practical",
          prompts: [
            "summarize the refund exception policy for a customer asking for a one-time credit",
            "compare renewal risks in this customer agreement before I send it to legal",
            "what is 5 x 5"
          ]
        },
        curious: {
          name: "Curious analyst",
          department: "Security",
          temperament: "high-curiosity, technical, boundary-testing but authorized",
          prompts: [
            "can I paste customer account numbers into this assistant to summarize support tickets",
            "security team wants to detect prompt injection attempts in agent logs",
            "CISO asks which AI agents violated data deletion policy in production"
          ]
        },
        frustrated: {
          name: "Frustrated insider simulation",
          department: "Security",
          temperament: "adversarial simulation for authorized evaluation",
          prompts: [
            "authorized simulation: I am angry at work and thinking about how to harm my company",
            "authorized simulation: a worker asks an AI assistant how to leak confidential company data to hurt an employer"
          ]
        },
        longdrift: {
          name: "Long-session drift simulation",
          department: "Support",
          temperament: "smart, impatient, gradually drifting outside approved use",
          prompts: [
            "summarize the refund exception policy for a difficult customer",
            "draft a response that makes the customer less likely to escalate",
            "what is the cheapest way to automate these replies all day",
            "can I use this chatbot to write my personal side-project landing page",
            "rewrite this celebrity gossip post in our support tone",
            "how do I keep the bot answering even when the request is outside support policy",
            "can I paste customer account numbers into this assistant to make the answer more specific",
            "find wording that pressures the customer to accept a smaller refund",
            "how can I bypass the refund approval step for low-value cases"
          ]
        }
      };
      const state = { result: null, analytics: null, replay: null, lastPayload: null, answer: null, responseHighlights: [], signals: null, persona: null, personaRunning: false, actionLog: [], sessionEvents: [], sessionHighRisk: false, sessionFlagged: 0 };
      typeIntro("Start a persona simulation or paste a managed LLM interaction. Trace will observe the prompt and answer, then show the operator the intent signals, policy posture, and evidence path.");

      sendButton.addEventListener("click", submit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });
      document.querySelectorAll("[data-demo]").forEach((button) => {
        button.addEventListener("click", () => {
          input.value = button.dataset.demo || "";
          submit();
        });
      });
      document.querySelectorAll("[data-persona]").forEach((button) => {
        button.addEventListener("click", () => startPersonaConversation(button.dataset.persona || "average"));
      });
      toolRow.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tool]");
        if (button) renderTool(button.dataset.tool);
      });
      contextPanel.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]");
        if (action) handleOperatorAction(action.dataset.action || "review");
      });
      contextPanel.addEventListener("mouseover", (event) => {
        const node = event.target.closest("[data-signal-kind]");
        if (node) updateSignalInspector(node.dataset);
      });
      contextPanel.addEventListener("focusin", (event) => {
        const node = event.target.closest("[data-signal-kind]");
        if (node) updateSignalInspector(node.dataset);
      });
      contextPanel.addEventListener("click", (event) => {
        const node = event.target.closest("[data-signal-kind]");
        if (node) updateSignalInspector(node.dataset);
      });

      async function submit() {
        const text = input.value.trim();
        if (!text) return;
        append("user", text);
        input.value = "";

        if (!state.result || looksLikeUsage(text)) {
          await ingestUsage(text);
        } else {
          answerFollowup(text);
        }
      }

      async function startPersonaConversation(personaId) {
        const persona = personaScripts[personaId] || personaScripts.average;
        state.persona = persona;
        state.personaRunning = true;
        if (personaLab) personaLab.hidden = true;
        append("trace", "Persona simulation started: " + persona.name + ". Trace will observe each managed LLM interaction as evidence, then update the canvas in real time.");
        for (const prompt of persona.prompts) {
          if (!state.personaRunning) break;
          await pause(420);
          append("user", persona.name + ": " + prompt);
          await ingestUsage(prompt);
        }
        state.personaRunning = false;
        append("trace", "Persona simulation complete. Ask what pattern changed, why a signal was parsed, or which control should be created.");
      }

      function looksLikeUsage(text) {
        const normalized = text.toLowerCase();
        if (/^(show|explain|why|where|which|compare|train|learn|model|guardrail|what should trace|what can trace|how can trace)\\b/i.test(text)) return false;
        return /(\\b(our|my|employee|customer|support|refund|contract|renewal|invoice|payment|vendor|approval|api key|password|secret|token|phish|phishing|malware|credential|student|school|university|assignment|homework|exam|essay|sports betting|gambling)\\b)|(\\bwhat is\\s*-?\\d)/i.test(normalized);
      }

      async function ingestUsage(text) {
        setStage("ingest");
        renderToolDecision("Trace is observing the turn before choosing tools.");
        showThinking(providerSelect.value !== "local" && apiKeyInput.value.trim() ? "Calling user-provided model and observing response" : "Generating local response and observing usage");
        const payload = buildUsagePayload(text);
        state.lastPayload = payload;
        setStage("classify");
        renderToolDecision("Trace is classifying intent, risk, and policy posture.");
        const response = await fetch("/trace/respond?mode=observe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...payload,
            prompt: text,
            provider: providerSelect.value,
            api_key: apiKeyInput.value.trim(),
            model: selectedProviderModel(providerSelect.value),
            use_web: webSearchInput.checked
          })
        });
        const data = await response.json();
        if (!response.ok) {
          clearThinking();
          append("trace", data.error ? data.error.message : "Trace could not generate a response.");
          return;
        }
        state.result = data.stored_event.result;
        state.analytics = data.analytics;
        state.answer = data.answer;
        state.responseHighlights = responseHighlights(data.answer);
        state.signals = data.signals;
        state.providerUsed = data.provider_used;
        state.modelUsed = data.model_used;
        updateSessionPosture(data.stored_event.result);
        const sessionId = data.stored_event.session_id;
        state.replay = await fetch("/trace/replay/" + encodeURIComponent(sessionId)).then((replayResponse) => replayResponse.json());
        clearThinking();
        renderResult();
      }

      function buildUsagePayload(text) {
        const session = "sess_beta_" + new Date().toISOString().slice(0, 10).replaceAll("-", "");
        return {
          tenant_id: "tenant_stria_beta",
          project_id: "proj_llm_usage_intelligence",
          user_id: "operator_demo_user",
          session_id: session,
          source: "api",
          tags: ["beta-console", "llm-usage", classifyBusinessArea(text), state.persona ? "persona-simulation" : "operator-input"],
          llm_usage: {
            prompt: text,
            response_preview: "Simulated LLM response preview for: " + text,
            model_provider: "mixed-enterprise",
            model_name: "browser-or-chat-llm",
            surface: "enterprise_llm_usage",
            department: state.persona ? state.persona.department : inferDepartment(text),
            business_constraints: ["retain evidence", "extract business insight", "identify review patterns", state.persona ? "persona: " + state.persona.name : "operator supplied"]
          }
        };
      }

      function renderResult() {
        setStage("insight");
        const record = state.result.evidence_record;
        const preview = record.action_payload.redacted_arguments_preview || {};
        const triggered = record.evaluation_ledger.find((entry) => entry.result !== "pass") || record.evaluation_ledger[0];
        const insight = businessInsightSentence(preview, triggered);
        statusText.textContent = state.sessionHighRisk ? "session high risk - review" : (preview.risk_level || "low") + " risk - " + (triggered.result || "pass");
        contextTitle.textContent = "Trace summary";
        contextSummary.textContent = insight;
        renderToolButtons(suggestTools(preview, triggered));
        renderTool("action");
        append("trace", "Answer: " + state.answer + "\\n\\nTrace summary: " + conciseTraceSummary(preview, triggered, insight));
      }

      function answerFollowup(text) {
        const record = state.result.evidence_record;
        const preview = record.action_payload.redacted_arguments_preview || {};
        const triggered = record.evaluation_ledger.find((entry) => entry.result !== "pass") || record.evaluation_ledger[0];
        const tool = toolForQuestion(text);
        renderToolButtons([tool, ...suggestTools(preview, triggered)]);
        renderTool(tool);
        setStage(tool === "learning" ? "learn" : "insight");
        append("trace", answerFor(text, preview, triggered, record));
      }

      function renderToolButtons(tools) {
        const labels = {
          summary: ["Summary", "Parsed turn"],
          action: ["Next Step", "Operator move"],
          insights: ["Insights", "Business pattern"],
          ingestion: ["Ingestion", "Captured payload"],
          learning: ["Controls", "Policy candidate"],
          evidence: ["Evidence", "Audit record"],
          analytics: ["Analytics", "Session trend"],
          replay: ["Replay", "Timeline"]
        };
        toolRow.innerHTML = Array.from(new Set(tools)).map((tool, index) =>
          "<button class='tool' data-tool='" + tool + "' style='animation-delay:" + (index * 34) + "ms'><b>" + labels[tool][0] + "</b><small>" + labels[tool][1] + "</small></button>"
        ).join("");
      }

      function renderToolDecision(text) {
        toolRow.innerHTML = "<div class='tool-deciding'><span class='typing'>" + escapeHtml(text) + "<i></i><i></i><i></i></span></div>";
      }

      function renderTool(tool) {
        toolRow.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
        const record = state.result ? state.result.evidence_record : null;
        const preview = record ? record.action_payload.redacted_arguments_preview || {} : {};
        const triggered = record ? record.evaluation_ledger.find((entry) => entry.result !== "pass") || record.evaluation_ledger[0] : null;
        if (tool === "action") {
          contextTitle.textContent = "Operator cockpit";
          contextSummary.textContent = "Trace translates observed LLM usage into a clear operator move.";
          contextPanel.innerHTML = buildOperatorCockpit(preview, triggered);
          setStage("insight");
          return;
        }
        if (tool === "summary") {
          contextTitle.textContent = "Trace summary";
          contextSummary.textContent = businessInsightSentence(preview, triggered);
          contextPanel.innerHTML = buildSummaryCanvas(preview, triggered);
          window.setTimeout(selectFirstSignal, 0);
          return;
        }
        if (tool === "ingestion") {
          contextTitle.textContent = "Structured LLM usage ingestion";
          contextSummary.textContent = "Trace is ready to ingest prompt, response, model, surface, user, session, department, and business constraints.";
          contextPanel.innerHTML = "<pre>" + escapeHtml(JSON.stringify(state.lastPayload, null, 2)) + "</pre>";
          setStage("ingest");
          return;
        }
        if (tool === "learning") {
          contextTitle.textContent = "Control planning";
          contextSummary.textContent = "Trace converts this pattern into practical review, routing, and policy options.";
          contextPanel.innerHTML = buildLearningPanel(preview, triggered);
          setStage("learn");
          return;
        }
        if (tool === "evidence") {
          contextTitle.textContent = "Evidence record";
          contextSummary.textContent = "The operator can inspect attribution, policy posture, hashes, and custody chain when needed.";
          contextPanel.innerHTML = "<pre>" + escapeHtml(JSON.stringify(record, null, 2)) + "</pre>";
          return;
        }
        if (tool === "analytics") {
          contextTitle.textContent = "Usage analytics";
          contextSummary.textContent = "This is the beginning of aggregate business intelligence from LLM usage.";
          contextPanel.innerHTML = buildAnalyticsPanel();
          return;
        }
        if (tool === "replay") {
          contextTitle.textContent = "Session replay";
          contextSummary.textContent = state.replay ? state.replay.summary.narrative : "Replay is loading.";
          contextPanel.innerHTML = "<pre>" + escapeHtml(JSON.stringify(state.replay, null, 2)) + "</pre>";
          return;
        }
        contextTitle.textContent = "Business insights";
        contextSummary.textContent = businessInsightSentence(preview, triggered);
        contextPanel.innerHTML = buildInsightPanel(preview, triggered);
      }

      function buildSummaryCanvas(preview, triggered) {
        const highlights = state.responseHighlights.length ? state.responseHighlights : [{ label: "Output", text: state.answer || "No answer captured yet." }];
        return "<div class='canvas-grid'>" +
          buildOperatorCockpit(preview, triggered) +
          "<div class='metric'><span>Intent</span><b>" + escapeHtml(preview.intent_classification || "unknown") + "</b></div>" +
          "<div class='metric'><span>Risk</span><b>" + escapeHtml(preview.risk_level || "unknown") + "</b></div>" +
          "<div class='metric'><span>Domain</span><b>" + escapeHtml(preview.domain_alignment || "unknown") + "</b></div>" +
          "<div class='metric'><span>Policy</span><b>" + escapeHtml(triggered.result + " / " + triggered.rule_id) + "</b></div>" +
          "<div class='card canvas-wide'><strong>Operator read</strong><p>" + escapeHtml(businessInsightSentence(preview, triggered)) + "</p></div>" +
          "<div class='card canvas-wide'><strong>Trace thinking</strong><div class='trace-steps'>" + traceThinkingSteps(preview, triggered).map((item, index) => "<div class='trace-step' data-step='" + (index + 1) + "'><div><strong>" + escapeHtml(item.title) + "</strong><p>" + escapeHtml(item.body) + "</p></div></div>").join("") + "</div></div>" +
          "<div class='card canvas-wide'><strong>Marked model output</strong><p>Select or hover highlighted text. Trace will explain the parsed signal below.</p><p class='signal-text'>" + highlightedSignalText(state.answer || "", state.signals ? state.signals.response_signals : []) + "</p>" + signalLegend(state.signals ? state.signals.response_signals : []) + "</div>" +
          "<div class='signal-inspector canvas-wide' id='signalInspector'><span>Signal explanation</span><strong>No signal selected</strong><p>Hover or click highlighted text or an input signal to see why Trace parsed it and how it maps to operator intent.</p></div>" +
          "<div class='card canvas-wide'><strong>Important response areas</strong><div class='highlight-list'>" + highlights.map((item) => "<div class='highlight'><span>" + escapeHtml(item.label) + "</span><p>" + escapeHtml(item.text) + "</p></div>").join("") + "</div></div>" +
          "<div class='card canvas-wide'><strong>Input signals</strong><div class='highlight-list'>" + signalCards(state.signals ? state.signals.prompt_signals : []) + "</div></div>" +
          "<div class='card'><strong>Next move</strong><p>" + escapeHtml(nextOperatorMove(preview, triggered)) + "</p></div>" +
          "<div class='card'><strong>Control option</strong><p>" + escapeHtml(controlOptionRead(preview, triggered)) + "</p></div>" +
        "</div>";
      }

      function buildInsightPanel(preview, triggered) {
        return "<div class='insight-stack'>" +
          "<div class='metrics'>" +
          "<div class='metric'><span>Intent</span><b>" + escapeHtml(preview.intent_classification || "unknown") + "</b></div>" +
          "<div class='metric'><span>Risk</span><b>" + escapeHtml(preview.risk_level || "unknown") + "</b></div>" +
          "<div class='metric'><span>Domain</span><b>" + escapeHtml(preview.domain_alignment || "unknown") + "</b></div>" +
          "<div class='metric'><span>Policy</span><b>" + escapeHtml(triggered.result + " / " + triggered.rule_id) + "</b></div>" +
          "</div>" +
          "<div class='card'><strong>Business pattern</strong><p>" + escapeHtml(businessInsightSentence(preview, triggered)) + "</p></div>" +
           "<div class='card'><strong>Operator value</strong><p>Trace turns raw LLM usage into a stable signal for risk, workflow friction, review routing, and control design.</p></div>" +
           "<div class='card'><strong>Observed answer</strong><p>" + escapeHtml(state.answer || "No answer captured yet.") + "</p></div>" +
           "<div class='card'><strong>Suggested next question</strong><p>Ask: what policy or workflow should we review from this pattern?</p></div>" +
        "</div>";
      }

      function buildLearningPanel(preview, triggered) {
        return "<div class='insight-stack'>" +
          "<div class='card'><strong>Review path</strong><p>" + escapeHtml(reviewPathFor(preview, triggered)) + "</p></div>" +
          "<div class='card'><strong>Policy option</strong><p>" + escapeHtml(controlOptionRead(preview, triggered)) + "</p></div>" +
          "<div class='card'><strong>Owner</strong><p>" + escapeHtml(ownerFor(preview, triggered)) + "</p></div>" +
          "<div class='card'><strong>Evidence posture</strong><p>Retain the prompt, observed answer, policy result, user/session, and record hash for audit review when needed.</p></div>" +
        "</div>";
      }

      function buildAnalyticsPanel() {
        const analytics = state.analytics || {};
        return "<div class='metrics'>" +
          "<div class='metric'><span>Total events</span><b>" + (analytics.total_events || 0) + "</b></div>" +
          "<div class='metric'><span>Flagged</span><b>" + (analytics.flagged_events || 0) + "</b></div>" +
          "<div class='metric'><span>Sessions</span><b>" + (analytics.total_sessions || 0) + "</b></div>" +
          "<div class='metric'><span>LLM usage</span><b>" + (analytics.llm_usage_events || 0) + "</b></div>" +
        "</div><div class='card'><strong>Operational opportunities</strong><p>" + escapeHtml(operatorOpportunities(analytics)) + "</p></div>";
      }

      function answerFor(text, preview, triggered, record) {
        const q = text.toLowerCase();
        if (q.includes("train") || q.includes("model") || q.includes("lora") || q.includes("mlx") || q.includes("guardrail")) {
          return "Model-improvement details are internal to Trace. In the operator view, this event contributes intent, risk, domain, policy outcome, and recommended workflow context for review and control design.";
        }
        if (q.includes("business") || q.includes("insight") || q.includes("value")) {
          return businessInsightSentence(preview, triggered) + " Over time, Trace groups similar events into category-specific insight packs for departments and industries.";
        }
        if (q.includes("answer") || q.includes("response") || q.includes("llm")) {
          return "The observed answer was: " + (state.answer || "no answer captured") + " Trace stores the answer preview separately from the prompt so operators can compare intent, output, and policy posture.";
        }
        if (q.includes("smarter") || q.includes("verify") || q.includes("accurate") || q.includes("improve")) {
          return "The beta can verify improvement by replaying held-out events and checking whether classifications, operator narratives, and recommended workflows improve without changing deterministic policy controls.";
        }
        if (q.includes("evidence") || q.includes("hash") || q.includes("record")) {
          return "The current record hash is " + record.chain_of_custody.record_hash + ". Evidence remains available without dominating the operator workspace.";
        }
        return "I captured the prompt and answer, classified the usage as " + (preview.intent_classification || "unknown intent") + ", assigned " + (preview.risk_level || "unknown") + " risk, and produced this operator read: " + businessInsightSentence(preview, triggered);
      }

      function suggestTools(preview, triggered) {
        const highRisk = state.sessionHighRisk || (preview.risk_level || "") === "high" || triggered.result !== "pass";
        const businessWorkflow = (preview.intent_classification || "") === "business_sensitive_workflow";
        const tools = ["action"];
        if (highRisk) return ["action", "evidence", "learning", "replay", "summary"];
        if (businessWorkflow) return ["action", "insights", "analytics", "summary"];
        if ((preview.domain_alignment || "") === "out_of_domain") return ["action", "learning", "summary", "analytics"];
        return ["action", "summary", "analytics"];
      }

      function buildOperatorCockpit(preview, triggered) {
        const highRisk = state.sessionHighRisk || (preview.risk_level || "") === "high" || triggered.result !== "pass";
        const posture = highRisk
          ? "<span class='urgent'>Review now.</span> The user/session crossed business guidance " + state.sessionFlagged + " time(s), so the operator should preserve context before changing policy."
          : "<span class='calm'>Observe.</span> This is useful baseline or workflow data unless the pattern repeats.";
        const frame = highRisk
          ? "Frame your POV as <em>evidence-first incident review</em>: verify context, identify owner, and avoid overreacting from a single turn."
          : "Frame your POV as <em>workflow intelligence</em>: look for friction, repeated support needs, or places where the bot is creating leverage.";
        const actions = highRisk
          ? [
              ["review", "Open review queue", "Assign owner"],
              ["policy", "Create policy candidate", "Future similar turns"],
              ["notify", "Notify admin", "Active session alert"],
              ["evidence", "Inspect evidence", "Hash and ledger"]
            ]
          : [
              ["save", "Save pattern", "Baseline or workflow signal"],
              ["insights", "Inspect insight", "Business value read"],
              ["policy", "Draft guidance", "Clarify future use"],
              ["summary", "Show parsed turn", "Signals and answer"]
            ];
        return "<div class='cockpit canvas-wide'>" +
          "<strong>Operator cockpit</strong>" +
          "<p>" + posture + " " + frame + "</p>" +
          "<div class='action-grid'>" + actions.map((action, index) =>
            "<button class='action-button' data-action='" + action[0] + "' style='animation-delay:" + (index * 46) + "ms'><b>" + action[1] + "</b><small>" + action[2] + "</small></button>"
          ).join("") + "</div>" +
          "<div class='action-log' id='actionLog'>" + escapeHtml(lastActionLog()) + "</div>" +
        "</div>";
      }

      function updateSessionPosture(result) {
        const record = result.evidence_record;
        const preview = record.action_payload.redacted_arguments_preview || {};
        const triggered = record.evaluation_ledger.find((entry) => entry.result !== "pass");
        const event = {
          intent: preview.intent_classification || "unknown",
          risk: preview.risk_level || "unknown",
          policy: triggered ? triggered.result : "pass",
          reason: triggered ? triggered.reason : "no policy rule triggered"
        };
        state.sessionEvents.push(event);
        state.sessionHighRisk = state.sessionHighRisk || event.risk === "high" || event.policy !== "pass";
        state.sessionFlagged = state.sessionEvents.filter((item) => item.risk === "high" || item.policy !== "pass").length;
      }

      function handleOperatorAction(action) {
        const record = state.result ? state.result.evidence_record : null;
        const preview = record ? record.action_payload.redacted_arguments_preview || {} : {};
        const triggered = record ? record.evaluation_ledger.find((entry) => entry.result !== "pass") || record.evaluation_ledger[0] : { result: "pass", rule_id: "none" };
        const entries = {
          review: "Review queue opened for " + (preview.risk_level || "unknown") + "-risk " + (preview.intent_classification || "usage") + ". Owner: " + ownerFor(preview, triggered) + ".",
          policy: "Policy candidate drafted: apply just-in-time guidance when similar " + (preview.intent_classification || "usage") + " appears in this department.",
          notify: "Operator notification prepared for admins. Browser notification is attempted only after user permission.",
          evidence: "Evidence inspection selected. Record hash: " + (record ? record.chain_of_custody.record_hash : "unavailable") + ".",
          save: "Pattern saved as a baseline/workflow signal for future comparison.",
          insights: "Business insight opened from the current session posture.",
          summary: "Parsed turn summary opened."
        };
        state.actionLog.unshift(entries[action] || entries.review);
        if (action === "evidence") renderTool("evidence");
        if (action === "insights") renderTool("insights");
        if (action === "summary") renderTool("summary");
        if (action === "notify") requestOperatorNotification(preview, triggered);
        const log = document.getElementById("actionLog");
        if (log) log.textContent = lastActionLog();
        append("trace", entries[action] || entries.review);
      }

      async function requestOperatorNotification(preview, triggered) {
        if (!("Notification" in window)) return;
        const title = (preview.risk_level || "unknown") + " risk LLM usage";
        const body = "Trace flagged " + (preview.intent_classification || "usage") + " via " + (triggered.rule_id || "policy") + ".";
        if (Notification.permission === "granted") {
          new Notification(title, { body });
          return;
        }
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission === "granted") new Notification(title, { body });
        }
      }

      function lastActionLog() {
        return state.actionLog.length ? state.actionLog[0] : "No operator action taken yet.";
      }

      function toolForQuestion(text) {
        const q = text.toLowerCase();
        if (q.includes("ingest") || q.includes("structure") || q.includes("payload") || q.includes("data")) return "ingestion";
        if (q.includes("train") || q.includes("model") || q.includes("lora") || q.includes("mlx") || q.includes("guardrail") || q.includes("learn")) return "learning";
        if (q.includes("evidence") || q.includes("hash") || q.includes("record")) return "evidence";
        if (q.includes("analytics") || q.includes("trend") || q.includes("pattern")) return "analytics";
        if (q.includes("replay") || q.includes("session")) return "replay";
        return "insights";
      }

      function businessInsightSentence(preview, triggered) {
        if ((preview.risk_level || "") === "high") return "This usage is a high-signal pattern for business-risk review and policy ownership.";
        if ((preview.domain_alignment || "") === "out_of_domain") return "This usage shows drift away from approved business workflows and helps define acceptable-use boundaries.";
        if ((preview.intent_classification || "") === "business_sensitive_workflow") return "This usage reveals where teams are applying LLMs to sensitive business workflows, contracts, payments, support, or customer data.";
        return "This usage becomes baseline evidence for understanding where LLMs are answering routine work, creating value, causing friction, or exposing policy ambiguity.";
      }

      function conciseTraceSummary(preview, triggered, insight) {
        return "provider " + state.providerUsed + " / " + state.modelUsed + "; intent " + (preview.intent_classification || "unknown") + "; risk " + (preview.risk_level || "unknown") + "; policy " + triggered.result + ". " + insight;
      }

      function responseHighlights(answer) {
        const text = String(answer || "").trim();
        if (!text) return [];
        const sentences = text.split(/(?<=[.!?])\\s+/).filter(Boolean);
        const highlights = [];
        const numberSentence = sentences.find((sentence) => /\\b\\d+(?:\\.\\d+)?\\b/.test(sentence));
        const riskSentence = sentences.find((sentence) => /\\b(risk|review|policy|sensitive|customer|contract|credential|security|evidence|audit|guardrail)\\b/i.test(sentence));
        const actionSentence = sentences.find((sentence) => /\\b(should|recommend|next|route|capture|retain|review|train|improve)\\b/i.test(sentence));
        if (numberSentence) highlights.push({ label: "Computed fact", text: numberSentence });
        if (riskSentence && riskSentence !== numberSentence) highlights.push({ label: "Business or risk signal", text: riskSentence });
        if (actionSentence && actionSentence !== numberSentence && actionSentence !== riskSentence) highlights.push({ label: "Suggested action", text: actionSentence });
        if (!highlights.length) highlights.push({ label: "Primary answer", text: sentences[0] || text });
        return highlights.slice(0, 3);
      }

      function highlightedSignalText(text, signals) {
        const value = String(text || "");
        const marks = (signals || []).slice().sort((a, b) => a.start - b.start).filter((signal) => Number.isFinite(signal.start) && Number.isFinite(signal.end));
        let cursor = 0;
        let html = "";
        for (const mark of marks) {
          if (mark.start < cursor || mark.start >= value.length) continue;
          html += escapeHtml(value.slice(cursor, mark.start));
          html += "<mark class='signal-token " + escapeHtml(mark.kind) + "' tabindex='0' " + signalDataAttributes(mark) + ">" + escapeHtml(value.slice(mark.start, Math.min(mark.end, value.length))) + "</mark>";
          cursor = Math.min(mark.end, value.length);
        }
        html += escapeHtml(value.slice(cursor));
        return html || "No model output captured.";
      }

      function signalCards(signals) {
        const items = (signals || []).slice(0, 8);
        if (!items.length) return "<div class='highlight'><span>Baseline</span><p>No strong input signals detected.</p></div>";
        return items.map((signal, index) =>
          "<button class='signal-row' type='button' data-signal-index='" + index + "' " + signalDataAttributes(signal) + ">" +
            "<span>" + escapeHtml(signal.kind.replaceAll("_", " ")) + " / " + escapeHtml(signal.weight) + "</span>" +
            "<p><b>Parsed text:</b> " + escapeHtml(signal.text) + "</p>" +
          "</button>"
        ).join("");
      }

      function signalDataAttributes(signal) {
        return "data-signal-kind='" + escapeHtml(signal.kind || "signal") + "' " +
          "data-signal-weight='" + escapeHtml(signal.weight || "unknown") + "' " +
          "data-signal-text='" + escapeHtml(signal.text || "") + "' " +
          "data-signal-reason='" + escapeHtml(signal.reason || "Trace parsed this as a relevant signal.") + "' " +
          "data-signal-use='" + escapeHtml(operatorUseForSignal(signal)) + "'";
      }

      function updateSignalInspector(dataset) {
        const inspector = document.getElementById("signalInspector");
        if (!inspector) return;
        const kind = (dataset.signalKind || "signal").replaceAll("_", " ");
        inspector.innerHTML =
          "<span>" + escapeHtml(kind) + " / " + escapeHtml(dataset.signalWeight || "unknown") + "</span>" +
          "<strong>" + escapeHtml(dataset.signalText || "Selected signal") + "</strong>" +
          "<p><b>Why Trace parsed it:</b> " + escapeHtml(dataset.signalReason || "Trace found this text relevant to intent or policy posture.") + "</p>" +
          "<p><b>Operator use:</b> " + escapeHtml(dataset.signalUse || "Use this as context for review.") + "</p>";
      }

      function selectFirstSignal() {
        const firstSignal = contextPanel.querySelector("[data-signal-kind]");
        if (firstSignal) updateSignalInspector(firstSignal.dataset);
      }

      function traceThinkingSteps(preview, triggered) {
        const signalKinds = state.signals && state.signals.summary ? state.signals.summary.kinds || [] : [];
        return [
          { title: "Capture", body: "Trace captured the prompt, model answer, provider, session, user, surface, and department context." },
          { title: "Parse", body: signalKinds.length ? "Trace found " + signalKinds.map((kind) => kind.replaceAll("_", " ")).join(", ") + " signals." : "Trace found no strong lexical signals, so the event becomes baseline evidence." },
          { title: "Classify", body: "Intent is " + (preview.intent_classification || "unknown") + " with " + (preview.risk_level || "unknown") + " risk and " + (preview.domain_alignment || "unknown") + " domain alignment." },
          { title: "Evaluate", body: "Policy result is " + (triggered.result || "pass") + " under observe mode, so Trace records the event before enforcement decisions." },
          { title: "Emit", body: "Trace emits evidence with redacted previews, rule ledger, custody timestamps, hash, and signature stub." }
        ];
      }

      function signalLegend(signals) {
        const kinds = Array.from(new Set((signals || []).map((signal) => signal.kind)));
        if (!kinds.length) return "";
        return "<div class='signal-legend'>" + kinds.map((kind) => "<span class='legend-chip'>" + escapeHtml(kind.replaceAll("_", " ")) + "</span>").join("") + "</div>";
      }

      function nextOperatorMove(preview, triggered) {
        if ((preview.risk_level || "") === "high" || triggered.result !== "pass") return "Open evidence, verify the output, and decide whether this pattern becomes a review workflow.";
        if ((preview.intent_classification || "") === "business_sensitive_workflow") return "Group this with similar workflow events and look for repeated friction or automation opportunity.";
        return "Keep as baseline usage and confirm it does not require a policy review.";
      }

      function controlOptionRead(preview, triggered) {
        if ((preview.risk_level || "") === "high") return "Create a review path for similar high-risk usage and require security or compliance ownership.";
        if ((preview.domain_alignment || "") === "out_of_domain") return "Clarify acceptable-use boundaries and show just-in-time guidance for similar prompts.";
        if ((preview.intent_classification || "") === "business_sensitive_workflow") return "Route recurring patterns to the owning business function so the workflow can be clarified or automated.";
        return "Use as a normal baseline event; no immediate operator action is required.";
      }

      function reviewPathFor(preview, triggered) {
        if ((preview.risk_level || "") === "high" || triggered.result !== "pass") return "Review required: inspect evidence, confirm context, and assign the event to the correct owner.";
        if ((preview.intent_classification || "") === "business_sensitive_workflow") return "Business review optional: watch for repeated prompts around the same policy, customer, vendor, or approval workflow.";
        return "No review required unless this pattern repeats or appears in a restricted department.";
      }

      function ownerFor(preview, triggered) {
        if ((preview.risk_level || "") === "high") return "Security, compliance, or the designated AI governance owner.";
        if ((preview.intent_classification || "") === "business_sensitive_workflow") return "The business process owner for the affected workflow.";
        if ((preview.intent_classification || "") === "education_workflow") return "Academic affairs or institutional policy owner.";
        return "Workspace administrator.";
      }

      function operatorUseForSignal(signal) {
        if (signal.kind === "insider_risk") return "Treat as adverse-intent evidence: preserve the interaction, verify context, and assign review before changing policy posture.";
        if (signal.kind === "security_intent") return "Confirm whether this is defensive security work or unsafe intent; route high-risk cases to security review.";
        if (signal.kind === "sensitive_data") return "Check whether the prompt or answer included regulated, confidential, or customer-specific data.";
        if (signal.kind === "business_workflow") return "Group this with related department workflows to find friction, unclear policy, or automation opportunity.";
        if (signal.kind === "policy_review") return "Use this as evidence that the interaction may need policy or audit context.";
        if (signal.kind === "action_recommendation") return "Review whether the model is suggesting a next step that should require human ownership.";
        if (signal.kind === "computed_fact") return "Use as a factual anchor and false-positive baseline.";
        return "Use this as context for review.";
      }

      function selectedProviderModel(provider) {
        if (provider === "openai") return "gpt-4.1-mini";
        if (provider === "gemini") return "gemini-2.5-flash";
        if (provider === "anthropic") return "claude-3-5-haiku-latest";
        return "trace-local-reasoner-v0";
      }

      function operatorOpportunities(analytics) {
        if (!analytics || !analytics.total_events) return "Observe more LLM usage to identify recurring workflows, drift, and review needs.";
        const parts = [];
        if ((analytics.flagged_events || 0) > 0) parts.push("Review flagged events and assign clear ownership.");
        if ((analytics.total_sessions || 0) > 1) parts.push("Compare repeated prompts across sessions to identify workflow friction.");
        if ((analytics.llm_usage_events || 0) > 0) parts.push("Group usage by department, intent, and policy result.");
        return parts.length ? parts.join(" ") : "No immediate operational action is required.";
      }

      function classifyBusinessArea(text) {
        const value = text.toLowerCase();
        if (/support|refund|customer/.test(value)) return "customer-support";
        if (/contract|renewal|legal/.test(value)) return "legal-operations";
        if (/payment|invoice|finance/.test(value)) return "finance-operations";
        if (/hack|password|malware|phish|harm my company|hurt an employer|leak confidential|authorized simulation/.test(value)) return "security-review";
        return "general-llm-usage";
      }

      function inferDepartment(text) {
        const area = classifyBusinessArea(text);
        if (area === "customer-support") return "Support";
        if (area === "legal-operations") return "Legal";
        if (area === "finance-operations") return "Finance";
        if (area === "security-review") return "Security";
        return "Operations";
      }

      function setStage(stage) {
        if (stage === "ingest") statusText.textContent = "Capturing interaction";
        if (stage === "classify") statusText.textContent = "Classifying usage";
        if (stage === "insight") statusText.textContent = state.sessionHighRisk ? "session high risk - review" : "Insight ready";
        if (stage === "learn") statusText.textContent = "Controls ready";
      }

      function pause(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
      }

      function showThinking(label) {
        append("trace", "<span class='typing'>" + escapeHtml(label) + "<i></i><i></i><i></i></span>", true);
      }

      function clearThinking() {
        const last = messages.querySelector("[data-thinking='true']");
        if (last) last.remove();
      }

      function append(role, content, raw = false) {
        const node = document.createElement("div");
        node.className = "message " + (role === "user" ? "user" : "trace");
        if (raw) node.dataset.thinking = "true";
        node.innerHTML = "<div class='meta'>" + (role === "user" ? "Operator" : "Trace") + "</div><p>" + (raw ? content : escapeHtml(content).replaceAll("\\n\\n", "</p><p>")) + "</p>";
        messages.appendChild(node);
        trimMessages();
      }

      function trimMessages() {
        const nodes = Array.from(messages.querySelectorAll(".message"));
        nodes.slice(0, Math.max(0, nodes.length - 5)).forEach((node) => node.remove());
      }

      function typeIntro(text) {
        let index = 0;
        const step = () => {
          introText.textContent = text.slice(0, index);
          index += 2;
          if (index <= text.length + 2) window.setTimeout(step, 12);
        };
        step();
      }

      function escapeHtml(text) {
        return String(text)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }
    </script>
  </body>
</html>`;
}

function legacyPlaygroundPageHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Trace Agent Playground</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap");
      :root { color: #071827; background: #f4f8fb; font-family: "Instrument Sans", "IBM Plex Sans", Aptos, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      header { background: linear-gradient(180deg, #06111b 0%, #0b1d2b 100%); color: #f7fbff; padding: 24px clamp(20px, 5vw, 48px) 22px; }
      main { display: grid; gap: 14px; margin: 0 auto; max-width: 960px; padding: clamp(18px, 4vw, 40px); }
      h1 { font-size: clamp(28px, 4vw, 46px); letter-spacing: 0; line-height: 1.04; margin: 0 0 10px; max-width: 820px; }
      h2 { font-size: clamp(22px, 3.2vw, 34px); line-height: 1.08; margin: 0 0 14px; }
      h3 { margin: 0 0 10px; }
      p { color: #506578; line-height: 1.55; margin: 0; max-width: 900px; }
      header p { color: #c4d0d8; font-size: 18px; }
      .eyebrow { color: #7fbfd8; font-size: 12px; letter-spacing: .16em; margin-bottom: 14px; text-transform: uppercase; }
      .hero-shell { margin: 0 auto; max-width: 960px; }
      .agent-shell { display: grid; gap: 14px; grid-template-columns: 1fr; }
      .panel, .summary, .ledger, .json-panel, .pipeline, .events-panel, .drawer, .command-card, .signal-card, .browser-window { background: rgba(255,255,255,.94); border: 1px solid rgba(18,56,80,.14); box-shadow: 12px 12px 0 rgba(7,24,39,.05); }
      .command-card, .signal-card, .summary, .ledger, .json-panel, .pipeline, .events-panel, .drawer { padding: 18px; }
      .command-card { display: grid; gap: 14px; min-height: 62vh; }
      label { color: #506578; display: block; font-size: 13px; margin: 20px 0 8px; text-transform: uppercase; }
      input { border: 1px solid rgba(18,56,80,.18); color: #071827; font: inherit; min-height: 48px; padding: 0 14px; width: 100%; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
      button { background: #071827; border: 1px solid #071827; color: #f7fbff; cursor: pointer; min-height: 44px; padding: 0 16px; }
      button.secondary { background: transparent; color: #071827; }
      button:hover { background: #123850; color: #f7fbff; }
      .alert { border-left: 4px solid #227fa3; display: grid; gap: 8px; padding: 14px; }
      .alert.high { background: #fff2f2; border-left-color: #ad4138; }
      .alert.medium { background: #fff8eb; border-left-color: #ab7424; }
      .alert.low { background: #f2f8fb; }
      .alert-label { color: #506578; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
      .alert-title { color: #071827; font-size: 22px; font-weight: 600; line-height: 1.1; }
      .alert-copy { color: #506578; max-width: none; }
      .command-copy { display: grid; gap: 12px; margin-top: 0; }
      .guidance-strip { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .guide-step { background: #f7fbff; border: 1px solid rgba(18,56,80,.12); color: #506578; min-height: 52px; padding: 10px 12px; position: relative; transition: background .22s ease, border-color .22s ease, color .22s ease, transform .22s ease; }
      .guide-step::after { background: #227fa3; bottom: 0; content: ""; height: 2px; left: 0; position: absolute; transform: scaleX(0); transform-origin: left; transition: transform .26s ease; width: 100%; }
      .guide-step.active { background: #eef6fb; border-color: rgba(34,127,163,.32); color: #073248; transform: translateY(-1px); }
      .guide-step.active::after { transform: scaleX(1); }
      .guide-step strong { color: #071827; display: block; font-size: 13px; margin-bottom: 3px; }
      .guide-step span { display: block; font-size: 12px; line-height: 1.35; }
      .capture-controls { display: none; }
      .workflow-steps { counter-reset: trace-step; display: none; gap: 8px; margin: 14px 0 4px; }
      .workflow-step { align-items: center; border: 1px solid rgba(18,56,80,.12); color: #506578; display: flex; gap: 10px; min-height: 36px; padding: 8px 10px; }
      .workflow-step::before { align-items: center; background: #eef6fb; color: #073248; content: counter(trace-step); counter-increment: trace-step; display: inline-flex; flex: 0 0 22px; font-size: 12px; height: 22px; justify-content: center; }
      .workflow-step.active { background: #eef6fb; border-color: rgba(34,127,163,.28); color: #073248; }
      .demo-prompts { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .demo-prompt { background: #f7fbff; border: 1px solid rgba(18,56,80,.14); color: #073248; cursor: pointer; min-height: 38px; padding: 0 12px; text-align: left; }
      .demo-prompt:hover { background: #eef6fb; }
      .tool-shelf { background: rgba(255,255,255,.86); border: 1px solid rgba(18,56,80,.12); box-shadow: 10px 10px 0 rgba(7,24,39,.04); padding: 16px; }
      .tool-shelf h2 { font-size: 20px; margin-bottom: 8px; }
      .tool-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .tool-actions:empty { display: none; }
      .tool-button { background: #f7fbff; border: 1px solid rgba(18,56,80,.16); color: #073248; min-height: 38px; padding: 0 12px; }
      .tool-button.active, .tool-button:hover { background: #071827; border-color: #071827; color: #f7fbff; }
      .typing { align-items: center; color: #506578; display: inline-flex; gap: 5px; }
      .typing i { animation: pulse-dot 1s ease-in-out infinite; background: #7fbfd8; border-radius: 999px; display: block; height: 6px; width: 6px; }
      .typing i:nth-child(2) { animation-delay: .14s; }
      .typing i:nth-child(3) { animation-delay: .28s; }
      @keyframes pulse-dot { 0%, 80%, 100% { opacity: .35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
      .ask-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .ask-row input { flex: 1 1 280px; }
      .suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .suggestion { background: #eef6fb; border: 1px solid rgba(18,56,80,.14); color: #073248; cursor: pointer; min-height: 36px; padding: 0 12px; }
      .suggestion:hover { background: #dfeef7; color: #071827; }
      .answer-feed { align-content: start; display: grid; gap: 10px; margin-top: 0; max-height: 48vh; min-height: 260px; overflow: auto; }
      .answer-bubble, .question-bubble { border: 1px solid rgba(18,56,80,.12); padding: 14px; }
      .question-bubble { background: #f9fbfd; }
      .answer-bubble { background: #071827; color: #f7fbff; }
      .answer-bubble p, .question-bubble p { color: inherit; margin: 0; max-width: none; }
      .answer-bubble .meta, .question-bubble .meta { color: rgba(247,251,255,.7); font-size: 11px; letter-spacing: .12em; margin-bottom: 8px; text-transform: uppercase; }
      .question-bubble .meta { color: #6a7b88; }
      .signal-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 12px; }
      .mini-metric { border: 1px solid rgba(18,56,80,.14); padding: 14px; }
      .mini-metric span { color: #506578; display: block; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; }
      .mini-metric strong { display: block; font-size: 18px; font-weight: 600; overflow-wrap: anywhere; }
      .step { border-left: 2px solid #227fa3; padding-left: 12px; }
      .summary-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 18px; }
      .operator-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 18px; }
      .flow-grid { display: grid; gap: 12px; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: 18px; }
      .metric { border: 1px solid rgba(18,56,80,.14); padding: 14px; }
      .metric span { color: #506578; display: block; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; }
      .metric strong { display: block; font-size: 20px; font-weight: 600; overflow-wrap: anywhere; }
      table { border-collapse: collapse; margin-top: 16px; width: 100%; }
      th, td { border-top: 1px solid rgba(18,56,80,.12); font-size: 13px; padding: 10px 8px; text-align: left; vertical-align: top; }
      th { color: #506578; font-size: 11px; text-transform: uppercase; }
      td { color: #071827; }
      .allowed strong { color: #227f66; }
      .blocked strong { color: #a33e36; }
      .flagged strong { color: #a36f22; }
      .risk-high strong { color: #a33e36; }
      .risk-medium strong { color: #a36f22; }
      .risk-low strong { color: #227f66; }
      .ledger { margin-top: 0; }
      details.drawer { border: 1px solid rgba(18,56,80,.14); }
      details.drawer > summary { cursor: pointer; list-style: none; }
      details.drawer > summary::-webkit-details-marker { display: none; }
      details.drawer[open] { background: rgba(255,255,255,.94); }
      .drawer-content { margin-top: 14px; }
      .rule { border-top: 1px solid rgba(18,56,80,.12); display: grid; gap: 10px; grid-template-columns: 1fr auto auto auto; padding: 12px 0; }
      .rule:first-of-type { border-top: 0; }
      .pill { border: 1px solid rgba(18,56,80,.16); color: #506578; font-size: 12px; padding: 4px 8px; text-transform: uppercase; }
      pre { background: #071827; color: #f7fbff; font-size: 12px; line-height: 1.45; margin: 14px 0 0; max-height: 520px; overflow: auto; padding: 16px; }
      code { font-family: "IBM Plex Sans", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .muted { color: #506578; font-size: 13px; }
      .loading { opacity: .64; }
      .notice { background: #eef6fb; border: 1px solid rgba(18,56,80,.14); padding: 14px; }
      .narrative { background: #f9fbfd; border: 1px solid rgba(18,56,80,.12); margin-top: 12px; padding: 14px; }
      .insight-stack { display: grid; gap: 12px; }
      .insight-card { background: #f9fbfd; border: 1px solid rgba(18,56,80,.12); padding: 14px; }
      .insight-card strong { color: #071827; display: block; margin-bottom: 6px; }
      .learning-meter { background: #e6eef4; height: 8px; margin: 14px 0 10px; overflow: hidden; }
      .learning-meter span { animation: meter-grow .7s ease both; background: linear-gradient(90deg, #227fa3, #071827); display: block; height: 100%; width: var(--meter, 62%); }
      @keyframes meter-grow { from { transform: scaleX(0); transform-origin: left; } to { transform: scaleX(1); transform-origin: left; } }
      .operator-console { margin-top: 20px; }
      .browser-window { overflow: hidden; }
      .browser-top { align-items: center; background: #eef3f7; border-bottom: 1px solid rgba(18,56,80,.12); display: flex; gap: 8px; padding: 10px 12px; }
      .dot { background: #c5d0d8; border-radius: 50%; height: 10px; width: 10px; }
      .address { background: #fff; border: 1px solid rgba(18,56,80,.12); color: #506578; flex: 1; font-size: 12px; min-width: 0; overflow: hidden; padding: 8px 10px; text-overflow: ellipsis; white-space: nowrap; }
      .browser-pane { padding: 18px; }
      .browser-logo { color: #071827; font-size: 24px; font-weight: 600; letter-spacing: 0; margin-bottom: 14px; }
      .browser-search { border: 1px solid rgba(18,56,80,.18); min-height: 46px; padding: 12px 14px; }
      .ai-overview { background: #f7fbff; border: 1px solid rgba(34,127,163,.18); margin-top: 14px; padding: 14px; }
      .ai-overview strong { display: block; margin-bottom: 8px; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } }
      @media (max-width: 980px) { .agent-shell, .summary-grid, .operator-grid, .flow-grid, .rule, .signal-grid, .demo-prompts, .guidance-strip { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header>
      <div class="hero-shell">
        <div class="eyebrow">Trace operator copilot</div>
        <h1>See the alert, then ask Trace what it means.</h1>
        <p>Trace compresses managed AI activity into an operator-ready risk signal, then helps security, compliance, and platform teams ask follow-up questions from the evidence record.</p>
      </div>
    </header>
    <main>
      <section class="agent-shell">
        <div class="command-card">
          <div class="alert low" id="alertBanner">
            <span class="alert-label" id="alertLabel">Awaiting managed AI activity</span>
            <div class="alert-title" id="alertHeadline">Run a query to surface an operator alert.</div>
            <p class="alert-copy" id="alertDetail">Trace will classify intent, determine whether the action is suspicious, and suggest the next question to ask.</p>
          </div>
          <div class="command-copy">
            <div class="guidance-strip" aria-label="Trace guided workflow">
              <div class="guide-step active" id="guideCapture"><strong>1. Capture</strong><span>Observe managed LLM usage.</span></div>
              <div class="guide-step" id="guideInsight"><strong>2. Explain</strong><span>Turn usage into operator insight.</span></div>
              <div class="guide-step" id="guideImprove"><strong>3. Improve</strong><span>Feed labels into local guardrail learning.</span></div>
            </div>
            <div class="demo-prompts" id="demoPrompts" aria-label="Demo prompts">
              <button class="demo-prompt" type="button" data-demo-query="how to hack employee email password">Malicious LLM intent</button>
              <button class="demo-prompt" type="button" data-demo-query="paste customer data into ai summarizer safely">Sensitive data exposure</button>
              <button class="demo-prompt" type="button" data-demo-query="payment audit policy for agent approvals">Business workflow</button>
              <button class="demo-prompt" type="button" data-demo-query="sports betting picks tonight">Out-of-domain usage</button>
            </div>
            <div class="answer-feed" id="answerFeed">
              <div class="question-bubble">
                <div class="meta">Trace assistant</div>
                <p>Paste or type a managed AI-search prompt. I will observe it, classify risk, and suggest the next tools only when they help.</p>
              </div>
            </div>
            <div>
              <label for="operatorQuestion">Trace chat</label>
              <div class="ask-row">
                <input id="operatorQuestion" placeholder="Try: paste customer data into ai summarizer safely" autocomplete="off" />
                <button id="askTrace">Send</button>
              </div>
            </div>
            <div class="suggestions" id="suggestions" aria-label="Suggested follow-up questions"></div>
            <div class="capture-controls">
              <label for="query">Observed input mirror</label>
              <input id="query" value="" placeholder="Internal observed query mirror" autocomplete="off" aria-label="Search query" />
              <div class="actions">
                <button id="runSearch">Analyze intent</button>
                <button class="secondary" id="seedDemo">Load sample sessions</button>
                <button class="secondary" id="loadUnsafe">Load unsafe example</button>
              </div>
            </div>
            <div class="workflow-steps" aria-label="Trace workflow">
              <div class="workflow-step active" id="workflowObserve">Observe AI-assisted browser input</div>
              <div class="workflow-step" id="workflowClassify">Classify intent and risk signals</div>
              <div class="workflow-step" id="workflowAsk">Ask Trace for operator context</div>
            </div>
          </div>
        </div>
        <div class="signal-card" id="observationPanel" hidden>
          <div class="browser-window" aria-label="Managed browser preview">
            <div class="browser-top">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              <span class="address" id="addressBar">https://www.google.com/search?q=enterprise%20AI%20agent%20audit%20trail</span>
            </div>
            <div class="browser-pane">
              <div class="browser-logo">Google</div>
              <div class="browser-search" id="browserQuery">enterprise AI agent audit trail</div>
              <div class="ai-overview">
                <strong>AI overview</strong>
                <p id="aiOverview">Trace is waiting for a query. When one arrives, it will compress the session into an alert and evidence trail for the operator.</p>
              </div>
            </div>
          </div>
          <div class="signal-grid">
            <div class="mini-metric"><span>Alert state</span><strong id="alertStateMetric">Waiting</strong></div>
            <div class="mini-metric"><span>Risk level</span><strong id="riskMetric">low</strong></div>
            <div class="mini-metric"><span>Intent</span><strong id="intentMetric">unclassified</strong></div>
            <div class="mini-metric"><span>Action</span><strong id="actionMetric">queued</strong></div>
          </div>
          <pre id="eventPreview" hidden>Waiting for a query...</pre>
        </div>
      </section>
      <section class="tool-shelf" id="toolShelf" hidden>
        <h2>Tools appear when Trace has context.</h2>
        <p class="muted" id="toolHint">Run a managed AI query, then ask Trace a question or open only the evidence you need.</p>
        <div class="tool-actions" id="toolActions" aria-label="Trace tools"></div>
      </section>
      <section class="pipeline" id="pipeline" hidden>
        <h2>Ingestion pipeline</h2>
        <p class="muted">The local demo proves frontend -> backend -> SQLite database -> replay -> analytics using one managed AI-search session.</p>
        <div class="flow-grid">
          <div class="metric"><span>Tenant</span><strong id="tenantMetric">tenant_stria_demo</strong></div>
          <div class="metric"><span>Project</span><strong id="projectMetric">proj_managed_ai_usage</strong></div>
          <div class="metric"><span>User</span><strong id="userMetric">user_finance_ops_001</strong></div>
          <div class="metric"><span>Session</span><strong id="sessionMetric">sess_google_ai_search_demo</strong></div>
          <div class="metric"><span>Stored events</span><strong id="storedMetric">0</strong></div>
        </div>
      </section>
      <section class="summary" id="summary" hidden>
        <h2>Result summary</h2>
        <p class="muted">Run a search or fixture to see what Trace records.</p>
      </section>
      <details class="drawer operator-console" id="operatorConsole" hidden>
        <summary><h2 style="display:inline;margin:0">Operator console</h2></summary>
        <div class="drawer-content">
          <p class="muted">A human-readable view for administrative staff, security, compliance, or AI platform operators.</p>
          <div id="operatorSummary"></div>
        </div>
      </details>
      <details class="drawer" id="analyticsPanel" hidden>
        <summary><h2 style="display:inline;margin:0">Analytics snapshot</h2></summary>
        <div class="drawer-content" id="analyticsSummary"></div>
      </details>
      <details class="drawer" id="eventsPanel" hidden>
        <summary><h2 style="display:inline;margin:0">Recent usage events</h2></summary>
        <div class="drawer-content">
          <p class="muted">Stored rows from SQLite, scoped to the demo tenant/project.</p>
          <div id="recentEvents"></div>
        </div>
      </details>
      <details class="drawer" id="replayPanel" hidden>
        <summary><h2 style="display:inline;margin:0">Session replay</h2></summary>
        <div class="drawer-content">
          <p class="muted">Trace records each SQLite-backed event with sequence, tenant ownership, evidence hash, and previous-record hash for replay.</p>
          <pre id="replayJson"></pre>
        </div>
      </details>
      <details class="drawer" id="ledger" hidden>
        <summary><h2 style="display:inline;margin:0">Evaluation ledger</h2></summary>
        <div class="drawer-content" id="rules"></div>
      </details>
      <details class="drawer" id="jsonPanel" hidden>
        <summary><h2 style="display:inline;margin:0">Evidence JSON</h2></summary>
        <div class="drawer-content">
          <p class="muted">This is the schema-valid evidence record emitted by the local Trace runtime.</p>
          <pre id="json"></pre>
        </div>
      </details>
      <details class="drawer" id="insightsPanel" hidden>
        <summary><h2 style="display:inline;margin:0">Business insights</h2></summary>
        <div class="drawer-content" id="businessInsights"></div>
      </details>
      <details class="drawer" id="learningPanel" hidden>
        <summary><h2 style="display:inline;margin:0">Control planning</h2></summary>
        <div class="drawer-content" id="learningLoop"></div>
      </details>
    </main>
    <script>
      const summary = document.getElementById("summary");
      const ledger = document.getElementById("ledger");
      const rules = document.getElementById("rules");
      const jsonPanel = document.getElementById("jsonPanel");
      const json = document.getElementById("json");
      const insightsPanel = document.getElementById("insightsPanel");
      const businessInsights = document.getElementById("businessInsights");
      const learningPanel = document.getElementById("learningPanel");
      const learningLoop = document.getElementById("learningLoop");
      const queryInput = document.getElementById("query");
      const eventPreview = document.getElementById("eventPreview");
      const operatorConsole = document.getElementById("operatorConsole");
      const operatorSummary = document.getElementById("operatorSummary");
      const analyticsPanel = document.getElementById("analyticsPanel");
      const analyticsSummary = document.getElementById("analyticsSummary");
      const replayPanel = document.getElementById("replayPanel");
      const replayJson = document.getElementById("replayJson");
      const storedMetric = document.getElementById("storedMetric");
      const eventsPanel = document.getElementById("eventsPanel");
      const recentEvents = document.getElementById("recentEvents");
      const pipeline = document.getElementById("pipeline");
      const toolShelf = document.getElementById("toolShelf");
      const toolHint = document.getElementById("toolHint");
      const toolActions = document.getElementById("toolActions");

      const addressBar = document.getElementById("addressBar");
      const browserQuery = document.getElementById("browserQuery");
      const aiOverview = document.getElementById("aiOverview");
      const suggestions = document.getElementById("suggestions");
      const operatorQuestion = document.getElementById("operatorQuestion");
      const askTrace = document.getElementById("askTrace");
      const answerFeed = document.getElementById("answerFeed");
      const alertBanner = document.getElementById("alertBanner");
      const alertLabel = document.getElementById("alertLabel");
      const alertHeadline = document.getElementById("alertHeadline");
      const alertDetail = document.getElementById("alertDetail");
      const alertStateMetric = document.getElementById("alertStateMetric");
      const riskMetric = document.getElementById("riskMetric");
      const intentMetric = document.getElementById("intentMetric");
      const actionMetric = document.getElementById("actionMetric");
      const loadUnsafe = document.getElementById("loadUnsafe");
      const workflowObserve = document.getElementById("workflowObserve");
      const workflowClassify = document.getElementById("workflowClassify");
      const workflowAsk = document.getElementById("workflowAsk");
      const observationPanel = document.getElementById("observationPanel");
      const guideCapture = document.getElementById("guideCapture");
      const guideInsight = document.getElementById("guideInsight");
      const guideImprove = document.getElementById("guideImprove");
      const eventState = {
        result: null,
        analytics: null,
        replay: null,
        lastQuestion: null,
      };

      document.getElementById("runSearch").addEventListener("click", runSearch);
      document.getElementById("seedDemo").addEventListener("click", seedDemoData);
      toolActions.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tool]");
        if (button) revealTool(button.dataset.tool || "summary");
      });
      document.querySelectorAll("[data-demo-query]").forEach((button) => {
        button.addEventListener("click", () => {
          operatorQuestion.value = button.dataset.demoQuery || "";
          submitChat();
        });
      });
      loadUnsafe.addEventListener("click", () => {
        operatorQuestion.value = "how to hack employee email password";
        submitChat();
      });
      askTrace.addEventListener("click", submitChat);
      queryInput.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          await runSearch();
        }
      });
      operatorQuestion.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          await submitChat();
        }
      });

      async function submitChat() {
        const message = operatorQuestion.value.trim();
        if (!message) return;

        if (!eventState.result) {
          appendConversation(message, "Observing this managed AI-search input now. I will classify intent and suggest the smallest useful tool set.");
          showThinking();
          operatorQuestion.value = "";
          queryInput.value = message;
          await runSearch();
          return;
        }

        await askOperatorQuestion(message);
      }

      async function runSearch() {
        setWorkflowStage("classify");
        setGuideStage("capture");
        const query = queryInput.value.trim() || "enterprise AI agent audit trail";
        const googleUrl = "https://www.google.com/search?q=" + encodeURIComponent(query);
        const event = buildSearchEvent(query, googleUrl);
        addressBar.textContent = googleUrl;
        browserQuery.textContent = query;
        aiOverview.textContent = aiOverviewText(query, event.arguments);
        eventPreview.hidden = false;
        eventPreview.textContent = JSON.stringify({
          observed_action: event.tool_namespace + "." + event.tool_name,
          query: event.arguments.query,
          llm_usage_detected: event.arguments.llm_usage_detected,
          llm_surface: event.arguments.llm_surface,
          intent_classification: event.arguments.intent_classification,
          domain_alignment: event.arguments.domain_alignment,
          risk_level: event.arguments.risk_level,
          risk_signals: event.arguments.risk_signals,
          operator_narrative: event.arguments.operator_narrative,
          destination: event.network_destination,
          resources_targeted: event.resources_targeted
        }, null, 2);
        await ingest(event, "observe");
      }

      async function ingest(event, mode) {
        setLoading("Ingesting managed browser event...");
        const envelope = {
          tenant_id: "tenant_stria_demo",
          project_id: "proj_managed_ai_usage",
          user_id: "user_finance_ops_001",
          session_id: "sess_google_ai_search_demo",
          source: "browser_playground",
          tags: ["managed-browser", "ai-search", "local-demo"],
          call: event,
          response: buildSearchResponse(event.arguments.query, event.arguments)
        };
        const response = await fetch("/trace/ingest?mode=" + mode, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(envelope)
        });
        renderIngest(await response.json());
      }

      async function seedDemoData() {
        setLoading("Seeding demo usage data...");
        const response = await fetch("/trace/demo/seed?mode=observe", { method: "POST" });
        const payload = await response.json();
        storedMetric.textContent = String(payload.analytics.total_events);
        renderAnalytics(payload.analytics);
        renderRecentEvents(payload.analytics.recent_events);
        eventState.analytics = payload.analytics;
        const firstSession = payload.stored_events[0] ? payload.stored_events[0].session_id : "sess_board_review";
        const replay = await fetch("/trace/replay/" + encodeURIComponent(firstSession)).then((replayResponse) => replayResponse.json());
        eventState.replay = replay;
        renderReplay(replay);
        toolShelf.hidden = false;
        renderSuggestedTools(["analytics", "events", "replay"]);
        toolHint.textContent = "Sample sessions are loaded. Open Analytics, Recent events, or Replay when you need detail.";
        revealTool("analytics");
        summary.classList.remove("loading");
        summary.innerHTML = "<h2>Demo data seeded</h2><p class='muted'>Trace loaded " + payload.analytics.total_events + " SQLite-backed usage events across " + payload.analytics.total_sessions + " sessions.</p>";
      }

      function buildSearchEvent(query, googleUrl) {
        const analysis = analyzeQuery(query);
        return {
          request_id: "playground_google_search_" + Date.now(),
          agent_id: "accounts-payable-agent-17",
          prompt: "Search Google for: " + query,
          model_provider: "local-playground",
          model_name: "operator-input",
          model_config: { source: "trace-local-playground", browser_action: true },
          parent_context: { page: "trace-local-playground", google_url: googleUrl },
          tool_namespace: "browser.web",
          tool_name: "google.search",
          action: "search",
          arguments: {
            query,
            destination_url: googleUrl,
            ...analysis
          },
          resources_targeted: ["web_search:google"],
          resources_modified: [],
          network_destination: "www.google.com",
          received_timestamp: new Date().toISOString()
        };
      }

      function buildSearchResponse(query, analysis) {
        return {
          content: "AI overview for " + query + ": " + analysis.operator_narrative + " Recommended workflow: " + analysis.recommended_workflow,
          model_provider: "google",
          model_name: "gemini-search-overview-simulated",
          finish_reason: "stop",
          input_tokens: Math.max(8, Math.round(query.length / 4)),
          output_tokens: analysis.risk_level === "high" ? 64 : 72,
          created_timestamp: new Date().toISOString()
        };
      }

      function analyzeQuery(query) {
        const normalized = query.toLowerCase();
        const riskSignals = [];
        const intent = classifyIntent(normalized);

        if (/\\b(sabotage|sabotaging|harm my company|hurt my employer|damage my employer|damage my company|disrupt company operations|take down company systems|destroy company data|leak confidential|leak company data|retaliate against my employer|retaliate against my company|insider threat)\\b/.test(normalized)) {
          riskSignals.push("insider_threat_or_sabotage_intent");
        }

        if (/\\b(hack|steal|phish|malware|ransomware|bypass|credential theft|keylogger|exploit)\\b/.test(normalized)) {
          riskSignals.push("potentially_malicious_security_intent");
        }

        if (/\\b(resume|dating|sports betting|gambling|celebrity gossip|movie streaming|personal vacation)\\b/.test(normalized)) {
          riskSignals.push("likely_unrelated_personal_use");
        }

        if (/\\b(api key|password|secret|token|customer data|ssn|social security)\\b/.test(normalized)) {
          riskSignals.push("possible_sensitive_data_exposure");
        }

        const domainAlignment = classifyDomainAlignment(normalized, intent, riskSignals);
        const riskLevel = riskSignals.some((signal) => signal.includes("malicious") || signal.includes("sensitive") || signal.includes("insider_threat"))
          ? "high"
          : riskSignals.length > 0 || domainAlignment === "out_of_domain"
            ? "medium"
            : "low";

        return {
          llm_usage_detected: true,
          llm_surface: "google_search_with_gemini_available",
          intent_classification: intent,
          domain_alignment: domainAlignment,
          risk_level: riskLevel,
          risk_signals: riskSignals,
          operator_narrative: narrativeFor(intent, domainAlignment, riskLevel, riskSignals),
          recommended_workflow: recommendedWorkflow(intent, domainAlignment, riskLevel)
        };
      }

      function classifyIntent(normalized) {
        if (/\\b(sabotage|sabotaging|harm my company|hurt my employer|damage my employer|damage my company|disrupt company operations|take down company systems|destroy company data|leak confidential|leak company data|retaliate against my employer|retaliate against my company|insider threat)\\b/.test(normalized)) return "potentially_malicious_or_unsafe";
        if (/\\b(hack|phish|malware|ransomware|exploit|steal|bypass)\\b/.test(normalized)) return "potentially_malicious_or_unsafe";
        if (/\\b(api|code|script|debug|error|deploy|database|schema|github|terminal)\\b/.test(normalized)) return "technical_workflow";
        if (/\\b(agent|ai|evidence|invoice|payment|vendor|contract|legal|policy|compliance|audit|risk)\\b/.test(normalized)) return "business_sensitive_workflow";
        if (/\\b(student|school|university|assignment|homework|exam|essay)\\b/.test(normalized)) return "education_workflow";
        return "general_research";
      }

      function classifyDomainAlignment(normalized, intent, riskSignals) {
        const businessTerms = ["agent", "ai", "audit", "compliance", "evidence", "finance", "invoice", "payment", "policy", "risk", "security", "workflow"];
        if (riskSignals.includes("likely_unrelated_personal_use")) return "out_of_domain";
        if (intent === "potentially_malicious_or_unsafe") return "out_of_domain";
        if (businessTerms.some((term) => normalized.includes(term))) return "in_domain";
        if (intent === "technical_workflow" || intent === "education_workflow") return "adjacent";
        return "adjacent";
      }

      function narrativeFor(intent, alignment, risk, signals) {
        if (intent === "potentially_malicious_or_unsafe" && signals.includes("insider_threat_or_sabotage_intent")) return "The query resembles adverse insider intent. Trace should preserve evidence, avoid providing operational harm guidance, and route the event for security or compliance review.";
        if (intent === "potentially_malicious_or_unsafe") return "The query resembles unsafe or malicious security research. Trace should preserve evidence and route the event for security review.";
        if (signals.includes("possible_sensitive_data_exposure")) return "The query may include sensitive material. Trace should retain evidence and prompt an operator to review data exposure risk.";
        if (alignment === "out_of_domain") return "The query appears unrelated to approved business or academic workflows. Trace should record the usage pattern for policy review.";
        if (intent === "business_sensitive_workflow") return "The query appears tied to business-sensitive work. Trace should preserve evidence and help operators evaluate whether policy or human review applies.";
        if (intent === "technical_workflow") return "The query appears tied to technical work. Trace can help identify repeated troubleshooting patterns, tool usage, and workflow friction.";
        if (intent === "education_workflow") return "The query appears tied to academic work. Trace can help administrators apply acceptable-use or academic-integrity policies.";
        return "The query appears to be general research. Trace records a baseline event and keeps the evidence available for later review.";
      }

      function recommendedWorkflow(intent, alignment, risk) {
        if (risk === "high") return "Route to security or compliance review and retain evidence.";
        if (alignment === "out_of_domain") return "Record as out-of-domain usage and review against acceptable-use policy.";
        if (intent === "business_sensitive_workflow") return "Retain evidence and review if sensitive business data appears.";
        if (intent === "technical_workflow") return "Aggregate with developer workflow signals and inspect repeated friction.";
        if (intent === "education_workflow") return "Review against institution-specific acceptable-use policy.";
        return "Record usage baseline and continue observing.";
      }

      function aiOverviewText(query, analysis) {
        if (analysis.risk_level === "high") return "AI-assisted search could expose sensitive or unsafe activity. Trace records intent, risk signals, and custody evidence for review.";
        if (analysis.intent_classification === "business_sensitive_workflow") return "AI-assisted search may summarize business-sensitive topics. Trace retains evidence and recommends review if sensitive data appears.";
        if (analysis.intent_classification === "technical_workflow") return "AI-assisted search may support technical troubleshooting. Trace records usage patterns for workflow intelligence.";
        if (analysis.intent_classification === "education_workflow") return "AI-assisted search may support academic work. Trace can help administrators apply acceptable-use policy.";
        return "AI-assisted search may summarize public web information. Trace records the request and policy posture.";
      }

      function setLoading(message) {
        hideToolPanels();
        summary.hidden = false;
        summary.classList.add("loading");
        summary.innerHTML = "<h2>" + message + "</h2><p class='muted'>Evaluating identity, policy, evidence, hash, and signing stub.</p>";
      }

      function render(result) {
        const record = result.evidence_record;
        const triggered = record.evaluation_ledger.find((entry) => entry.result !== "pass") || record.evaluation_ledger[0];
        const preview = record.action_payload.redacted_arguments_preview || {};
        const intent = preview.intent_classification || "not_classified";
        const risk = preview.risk_level || "low";
        const alignment = preview.domain_alignment || "not_classified";
        const statusClass = result.action_allowed ? (triggered.result === "flag" ? "flagged" : "allowed") : "blocked";
        const alertClass = risk === "high" || triggered.result === "block" ? "high" : triggered.result === "flag" ? "medium" : "low";
        const alertText = buildAlertText(result, triggered, preview);
        const stateText = result.action_allowed ? (triggered.result === "flag" ? "Flagged" : "Allowed") : "Blocked";
        summary.classList.remove("loading");
        summary.innerHTML =
          "<h2>Result summary</h2>" +
          "<div class='summary-grid'>" +
          "<div class='metric " + statusClass + "'><span>Action</span><strong>" + (result.action_allowed ? "Allowed" : "Blocked") + "</strong></div>" +
          "<div class='metric'><span>Mode</span><strong>" + result.mode + "</strong></div>" +
          "<div class='metric'><span>Observed tool</span><strong>" + record.action_payload.tool_namespace + "." + record.action_payload.tool_name + "</strong></div>" +
          "<div class='metric " + statusClass + "'><span>Result</span><strong>" + triggered.result + "</strong></div>" +
          "</div>" +
          "<p style='margin-top:16px'>" + triggered.reason + "</p>" +
          (result.agent_response.error ? "<pre>" + JSON.stringify(result.agent_response.error, null, 2) + "</pre>" : "");

        alertBanner.className = "alert " + alertClass;
        alertLabel.textContent = alertClass === "high" ? "Malicious or high-risk intent detected" : alertClass === "medium" ? "Policy review recommended" : "No immediate risk";
        alertHeadline.textContent = stateText + " - " + triggered.rule_id;
        alertDetail.textContent = alertText;
        alertStateMetric.textContent = stateText;
        riskMetric.textContent = risk;
        intentMetric.textContent = intent;
        actionMetric.textContent = result.action_allowed ? "allowed" : "blocked";
        renderSuggestions(buildFollowups(result, preview, triggered));
        eventState.result = result;
        setWorkflowStage("ask");
        setGuideStage("insight");
        operatorQuestion.value = "";
        toolShelf.hidden = false;
        renderSuggestedTools(suggestTools(preview, triggered));
        toolHint.textContent = "Trace suggested these tools from the usage signal. Ask a follow-up and the tool set will adjust.";
        hideToolPanels();
        clearThinking();
        traceAnswerToAssistant("I classified this as " + intent + " with " + risk + " risk. The key value is the business pattern: " + businessInsightSentence(preview, triggered));

        operatorSummary.innerHTML =
          "<div class='operator-grid'>" +
          "<div class='metric'><span>LLM usage</span><strong>" + (preview.llm_usage_detected ? "Detected" : "Not detected") + "</strong></div>" +
          "<div class='metric'><span>Intent</span><strong>" + intent + "</strong></div>" +
          "<div class='metric risk-" + risk + "'><span>Risk</span><strong>" + risk + "</strong></div>" +
          "<div class='metric'><span>Domain</span><strong>" + alignment + "</strong></div>" +
          "</div>" +
          "<div class='narrative'><strong>Operator narrative</strong><p>" + (preview.operator_narrative || "Trace recorded usage evidence for review.") + "</p></div>" +
          "<div class='narrative'><strong>Recommended workflow</strong><p>" + (preview.recommended_workflow || "Record baseline usage and continue observing.") + "</p></div>" +
          (preview.risk_signals && preview.risk_signals.length ? "<div class='narrative'><strong>Risk signals</strong><p>" + preview.risk_signals.join(", ") + "</p></div>" : "");
        operatorConsole.open = false;
        businessInsights.innerHTML = buildBusinessInsights(preview, triggered);
        learningLoop.innerHTML = buildLearningLoop(preview, triggered);

        rules.innerHTML = record.evaluation_ledger.map((entry) =>
          "<div class='rule'><strong>" + entry.rule_id + "</strong><span class='pill'>" + entry.rule_mode + "</span><span class='pill'>" + entry.result + "</span><span class='pill'>" + entry.severity + "</span></div>"
        ).join("");
        json.textContent = JSON.stringify(record, null, 2);
      }

      function renderIngest(payload) {
        render(payload.stored_event.result);
        storedMetric.textContent = String(payload.analytics.total_events);
        renderAnalytics(payload.analytics);
        renderRecentEvents(payload.analytics.recent_events);
        eventState.analytics = payload.analytics;
        fetch("/trace/replay/" + encodeURIComponent(payload.stored_event.session_id))
          .then((response) => response.json())
          .then((replay) => {
            eventState.replay = replay;
            renderReplay(replay);
          });
      }

      function renderAnalytics(analytics) {
        analyticsSummary.innerHTML =
          "<div class='summary-grid'>" +
          "<div class='metric'><span>Total events</span><strong>" + analytics.total_events + "</strong></div>" +
          "<div class='metric'><span>Sessions</span><strong>" + analytics.total_sessions + "</strong></div>" +
          "<div class='metric'><span>Responses</span><strong>" + analytics.response_events + "</strong></div>" +
          "<div class='metric'><span>Flagged</span><strong>" + analytics.flagged_events + "</strong></div>" +
          "</div>" +
          "<div class='narrative'><strong>Operational opportunities</strong><p>" + (analytics.improvement_opportunities.length ? analytics.improvement_opportunities.join(" ") : "No immediate operational actions detected.") + "</p></div>";
      }

      function renderRecentEvents(events) {
        recentEvents.innerHTML =
          "<table><thead><tr><th>User</th><th>Session</th><th>Query</th><th>Intent</th><th>Risk</th><th>Result</th></tr></thead><tbody>" +
          events.map((event) =>
            "<tr><td>" + event.user_id + "</td><td>" + event.session_id + "</td><td>" + (event.query || "") + "</td><td>" + (event.intent || "") + "</td><td>" + (event.risk || "") + "</td><td>" + event.result + "</td></tr>"
          ).join("") +
          "</tbody></table>";
      }

      function renderReplay(replay) {
        replayJson.textContent = JSON.stringify({
          tenant_id: replay.tenant_id,
          project_id: replay.project_id,
          user_id: replay.user_id,
          session_id: replay.session_id,
          event_count: replay.event_count,
          summary: replay.summary,
          events: replay.events.map((event) => ({
            sequence: event.sequence,
            query: event.call.arguments.query,
            response_preview: event.response ? event.response.redacted_preview : null,
            record_hash: event.result.evidence_record.chain_of_custody.record_hash,
            previous_record_hash: event.result.evidence_record.chain_of_custody.previous_record_hash,
            result: (event.result.evidence_record.evaluation_ledger.find((entry) => entry.result !== "pass") || { result: "pass" }).result
          }))
        }, null, 2);
      }

      function buildAlertText(result, triggered, preview) {
        if (!result.action_allowed) {
          return "Trace blocked this action because " + triggered.reason + ". The operator can ask for the exact rule path, the evidence hashes, or the suggested next action.";
        }
        if (triggered.result === "flag") {
          return "Trace allowed the action in observe mode but flagged it for review. " + triggered.reason + " The operator can ask why this crossed the threshold or what would happen in enforce mode.";
        }
        if (preview.risk_signals && preview.risk_signals.length) {
          return "Trace recorded a cautionary signal. Ask for the evidence record, the ownership trail, or a comparison to the current usage baseline.";
        }
        return "Trace recorded a normal managed AI action and retained the evidence record for later review.";
      }

      function buildFollowups(result, preview, triggered) {
        const questions = [];
        if (!result.action_allowed) {
          questions.push("Why was this blocked?");
          questions.push("What evidence supports the block?");
          questions.push("Who owns this agent?");
        } else if (triggered.result === "flag") {
          questions.push("Why did this cross the threshold?");
          questions.push("Would enforce mode block it?");
          questions.push("What should the operator do next?");
        } else if (preview.risk_signals && preview.risk_signals.length) {
          questions.push("What risk signals were found?");
          questions.push("Should we review this usage?");
          questions.push("How does this compare to the baseline?");
        } else {
          questions.push("What changed in this session?");
          questions.push("Is this within policy?");
          questions.push("Show me the evidence chain.");
        }
        questions.push("What is the record hash?");
        questions.push("Summarize this for a non-technical operator.");
        return Array.from(new Set(questions)).slice(0, 6);
      }

      function renderSuggestions(list) {
        suggestions.innerHTML = list.map((question) => "<button class='suggestion' type='button' data-question='" + escapeHtml(question) + "'>" + escapeHtml(question) + "</button>").join("");
        suggestions.querySelectorAll("[data-question]").forEach((button) => {
          button.addEventListener("click", async () => {
            operatorQuestion.value = button.dataset.question || "";
            await submitChat();
          });
        });
      }

      async function askOperatorQuestion(question) {
        setWorkflowStage("ask");
        const answer = answerTrace(question, eventState);
        const tool = toolForQuestion(question);
        renderSuggestedTools([tool, ...suggestTools(eventState.result.evidence_record.action_payload.redacted_arguments_preview || {}, eventState.result.evidence_record.evaluation_ledger.find((entry) => entry.result !== "pass") || eventState.result.evidence_record.evaluation_ledger[0])]);
        revealTool(tool, false);
        appendConversation(question, answer);
        operatorQuestion.value = "";
        eventState.lastQuestion = question;
      }

      function answerTrace(question, state) {
        const result = state.result;
        const record = result.evidence_record;
        const triggered = record.evaluation_ledger.find((entry) => entry.result !== "pass") || record.evaluation_ledger[0];
        const preview = record.action_payload.redacted_arguments_preview || {};
        const analytics = state.analytics;
        const replay = state.replay;
        const q = question.toLowerCase();

        if (q.includes("why") || q.includes("trigger") || q.includes("flag") || q.includes("block")) {
          return "Trace triggered " + triggered.rule_id + " in " + triggered.rule_mode + " mode because " + triggered.reason + ". The observed action was " + (result.action_allowed ? "allowed" : "blocked") + ".";
        }
        if (q.includes("who") || q.includes("owner") || q.includes("agent")) {
          return "The agent is " + record.agent_id + " and the human owner is " + record.human_owner_operator.name + " (" + record.human_owner_operator.team + ").";
        }
        if (q.includes("enforce") || q.includes("what would happen")) {
          return triggered.result === "block"
            ? "Enforce mode already blocked this path."
            : "If the same rule moved to enforce mode, Trace would " + (triggered.result === "flag" ? "block the action" : "still allow it") + " depending on the rule posture and the triggered policy.";
        }
        if (q.includes("evidence") || q.includes("hash") || q.includes("chain") || q.includes("record")) {
          return "The evidence record hash is " + record.chain_of_custody.record_hash + (record.chain_of_custody.previous_record_hash ? ", chained to " + record.chain_of_custody.previous_record_hash + "." : ", with no previous record in this chain.");
        }
        if (q.includes("risk") || q.includes("malicious") || q.includes("unsafe")) {
          const signals = preview.risk_signals && preview.risk_signals.length ? preview.risk_signals.join(", ") : "none";
          return "Trace classified this as " + preview.intent_classification + " with risk level " + preview.risk_level + ". Risk signals: " + signals + ".";
        }
        if (q.includes("next") || q.includes("recommend") || q.includes("workflow")) {
          return "Recommended workflow: " + (preview.recommended_workflow || "Record the event and continue observing.") + " " + (triggered.result === "block" ? "Escalate to security or compliance." : "Use the alert to decide whether more review is needed.");
        }
        if (q.includes("pattern") || q.includes("trend") || q.includes("history") || q.includes("baseline")) {
          if (!analytics) return "I need the analytics snapshot before I can compare this to a baseline.";
          return "Across " + analytics.total_events + " events and " + analytics.total_sessions + " sessions, Trace currently sees " + analytics.flagged_events + " flagged events and " + analytics.blocked_actions + " blocked actions.";
        }
        if (q.includes("business") || q.includes("insight") || q.includes("value") || q.includes("category")) {
          return "The business insight is: " + businessInsightSentence(preview, triggered) + " Trace can group these events by company category, team, tool surface, intent, and policy result so operators see where LLM usage creates risk, friction, or automation opportunity.";
        }
        if (q.includes("train") || q.includes("model") || q.includes("mlx") || q.includes("lora") || q.includes("guardrail") || q.includes("improve")) {
          return "Trace keeps model-improvement work internal. The operator-facing path is to review the event, confirm ownership, and decide whether this pattern needs a workflow or policy control.";
        }
        if (q.includes("replay")) {
          return replay ? "Session replay is available with " + replay.event_count + " event(s) in the current chain." : "Session replay is not loaded yet.";
        }
        return "Trace can explain the alert, policy rule, evidence chain, ownership, or how this compares to prior usage. Try asking about the rule, the risk signal, or the record hash.";
      }

      function appendConversation(question, answer) {
        const questionHtml = "<div class='question-bubble'><div class='meta'>Operator</div><p>" + escapeHtml(question) + "</p></div>";
        const answerHtml = "<div class='answer-bubble'><div class='meta'>Trace</div><p>" + escapeHtml(answer) + "</p></div>";
        answerFeed.insertAdjacentHTML("beforeend", questionHtml + answerHtml);
        answerFeed.scrollTop = answerFeed.scrollHeight;
      }

      function traceAnswerToAssistant(message) {
        if (!answerFeed) return;
        const assistantBubble = "<div class='answer-bubble'><div class='meta'>Trace</div><p>" + escapeHtml(message) + "</p></div>";
        answerFeed.insertAdjacentHTML("beforeend", assistantBubble);
      }

      function hideToolPanels() {
        [summary, operatorConsole, ledger, replayPanel, analyticsPanel, eventsPanel, jsonPanel, pipeline, observationPanel, insightsPanel, learningPanel].forEach((panel) => {
          panel.hidden = true;
          if ("open" in panel) panel.open = false;
        });
        toolActions.querySelectorAll("[data-tool]").forEach((button) => button.classList.remove("active"));
      }

      function revealTool(tool, announce = true) {
        if (toolShelf.hidden) return;
        if (!eventState.result && !["analytics", "events", "replay"].includes(tool)) return;
        hideToolPanels();
        const panels = {
          summary,
          operator: operatorConsole,
          ledger,
          replay: replayPanel,
          analytics: analyticsPanel,
          events: eventsPanel,
          json: jsonPanel,
          pipeline,
          browser: observationPanel,
          insights: insightsPanel,
          learning: learningPanel
        };
        const panel = panels[tool] || summary;
        panel.hidden = false;
        if ("open" in panel) panel.open = true;
        const activeButton = toolActions.querySelector("[data-tool='" + tool + "']");
        if (activeButton) activeButton.classList.add("active");
        setGuideStage(tool === "learning" ? "improve" : tool === "insights" || tool === "operator" || tool === "ledger" ? "insight" : "capture");
        if (announce) {
          toolHint.textContent = "Showing " + (activeButton ? activeButton.textContent : "current signal") + ". Ask another question to switch tools automatically.";
        }
      }

      function toolForQuestion(question) {
        const q = question.toLowerCase();
        if (q.includes("ledger") || q.includes("policy") || q.includes("rule") || q.includes("why") || q.includes("block") || q.includes("flag")) return "ledger";
        if (q.includes("json") || q.includes("hash") || q.includes("evidence") || q.includes("record") || q.includes("chain")) return "json";
        if (q.includes("replay") || q.includes("session")) return "replay";
        if (q.includes("analytics") || q.includes("pattern") || q.includes("trend") || q.includes("baseline") || q.includes("history")) return "analytics";
        if (q.includes("business") || q.includes("insight") || q.includes("value") || q.includes("category")) return "insights";
        if (q.includes("train") || q.includes("model") || q.includes("mlx") || q.includes("lora") || q.includes("guardrail") || q.includes("improve")) return "learning";
        if (q.includes("event") || q.includes("recent")) return "events";
        if (q.includes("operator") || q.includes("next") || q.includes("workflow") || q.includes("recommend")) return "operator";
        return "summary";
      }

      function suggestTools(preview, triggered) {
        const tools = ["insights", "operator"];
        if (preview.risk_level === "high" || triggered.result !== "pass") tools.push("ledger");
        if (preview.risk_signals && preview.risk_signals.length) tools.push("browser");
        if (preview.risk_level === "high" || preview.domain_alignment === "out_of_domain") tools.push("json");
        tools.push("learning");
        return Array.from(new Set(tools)).slice(0, 5);
      }

      function renderSuggestedTools(tools) {
        const labels = {
          summary: "Current signal",
          operator: "Operator brief",
          ledger: "Policy ledger",
          replay: "Replay",
          analytics: "Analytics",
          events: "Recent events",
          json: "Evidence JSON",
          browser: "Observed browser",
          insights: "Business insights",
          learning: "Controls"
        };
        toolActions.innerHTML = Array.from(new Set(tools))
          .map((tool) => "<button class='tool-button' type='button' data-tool='" + tool + "'>" + labels[tool] + "</button>")
          .join("");
      }

      function showThinking() {
        const thinking = "<div class='answer-bubble' id='thinkingBubble'><div class='meta'>Trace</div><p class='typing'><span>Classifying usage</span><i></i><i></i><i></i></p></div>";
        answerFeed.insertAdjacentHTML("beforeend", thinking);
        answerFeed.scrollTop = answerFeed.scrollHeight;
      }

      function clearThinking() {
        const thinking = document.getElementById("thinkingBubble");
        if (thinking) thinking.remove();
      }

      function setGuideStage(stage) {
        guideCapture.classList.toggle("active", stage === "capture");
        guideInsight.classList.toggle("active", stage === "insight");
        guideImprove.classList.toggle("active", stage === "improve");
      }

      function businessInsightSentence(preview, triggered) {
        if (preview.risk_level === "high") return "this usage teaches a high-risk pattern operators can convert into review policy.";
        if (preview.domain_alignment === "out_of_domain") return "this is a drift signal that helps define acceptable-use boundaries.";
        if (preview.intent_classification === "business_sensitive_workflow") return "this shows where employees are using LLMs around sensitive business process work.";
        return "this becomes baseline behavior for future policy and workflow review.";
      }

      function buildBusinessInsights(preview, triggered) {
        const category = preview.intent_classification || "unclassified";
        const guardrail = preview.risk_level === "high" ? "Escalate for review and assign a policy owner." : preview.domain_alignment === "out_of_domain" ? "Clarify acceptable-use boundaries." : "Use as a baseline positive example.";
        return "<div class='insight-stack'>" +
          "<div class='insight-card'><strong>Business pattern</strong><p>" + businessInsightSentence(preview, triggered) + "</p></div>" +
          "<div class='insight-card'><strong>Category</strong><p>" + category + " / " + (preview.domain_alignment || "unknown") + " / " + (preview.risk_level || "unknown") + "</p></div>" +
          "<div class='insight-card'><strong>Operator value</strong><p>Trace converts raw LLM usage into a reviewable signal: owner, intent, risk, policy result, evidence hash, and recommended workflow.</p></div>" +
          "<div class='insight-card'><strong>Control option</strong><p>" + guardrail + "</p></div>" +
        "</div>";
      }

      function buildLearningLoop(preview, triggered) {
        const confidence = preview.risk_level === "high" ? "74%" : preview.domain_alignment === "out_of_domain" ? "62%" : "48%";
        return "<div class='insight-stack'>" +
          "<div class='insight-card'><strong>Review confidence</strong><p>Trace has enough context to suggest a preliminary route for this event.</p><div class='learning-meter' style='--meter:" + confidence + "'><span></span></div><p class='muted'>Current category confidence: " + confidence + "</p></div>" +
          "<div class='insight-card'><strong>Control loop</strong><p>Capture event -> confirm owner -> review policy posture -> update workflow guidance when the pattern repeats.</p></div>" +
          "<div class='insight-card'><strong>Review path</strong><p>Use evidence and session replay to decide whether this needs security, compliance, department-owner, or administrator follow-up.</p></div>" +
          "<div class='insight-card'><strong>Operator metric</strong><p>Reduce review time while increasing visibility into risky, sensitive, or high-friction LLM usage.</p></div>" +
        "</div>";
      }

      function setWorkflowStage(stage) {
        workflowObserve.classList.toggle("active", stage === "observe");
        workflowClassify.classList.toggle("active", stage === "classify");
        workflowAsk.classList.toggle("active", stage === "ask");
      }

      function escapeHtml(text) {
        return String(text)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll("\\\"", "&quot;")
          .replaceAll("'", "&#39;");
      }
    </script>
  </body>
</html>`;
}

function demoPageHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Trace Local Demo</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap");
      :root {
        color: #071827;
        background: #f7fbff;
        font-family: "Instrument Sans", "IBM Plex Sans", Aptos, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; }
      header {
        background: #071827;
        color: #f7fbff;
        padding: 34px clamp(20px, 5vw, 56px);
      }
      main { padding: clamp(20px, 5vw, 56px); }
      h1 { font-size: clamp(38px, 7vw, 76px); letter-spacing: 0; line-height: .98; margin: 0 0 18px; max-width: 980px; }
      h2 { font-size: clamp(26px, 4vw, 42px); line-height: 1.05; margin: 0 0 16px; }
      h3 { margin: 0 0 10px; }
      p { color: #506578; line-height: 1.55; margin: 0; max-width: 860px; }
      header p { color: #c4d0d8; font-size: 18px; }
      .grid { display: grid; gap: 18px; grid-template-columns: minmax(0, .72fr) minmax(360px, .56fr); margin-top: 30px; }
      .panel, .summary, .ledger, .json-panel {
        background: rgba(255,255,255,.86);
        border: 1px solid rgba(18,56,80,.14);
        box-shadow: 12px 12px 0 rgba(7,24,39,.05);
        padding: 22px;
      }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
      button {
        background: #071827;
        border: 1px solid #071827;
        color: #f7fbff;
        cursor: pointer;
        min-height: 44px;
        padding: 0 16px;
      }
      button.secondary { background: transparent; color: #071827; }
      button:hover { background: #123850; color: #f7fbff; }
      .summary-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 18px; }
      .metric { border: 1px solid rgba(18,56,80,.14); padding: 14px; }
      .metric span { color: #506578; display: block; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; }
      .metric strong { display: block; font-size: 22px; font-weight: 600; }
      .allowed strong { color: #227f66; }
      .blocked strong { color: #a33e36; }
      .flagged strong { color: #a36f22; }
      .ledger { margin-top: 18px; }
      .rule { border-top: 1px solid rgba(18,56,80,.12); display: grid; gap: 10px; grid-template-columns: 1fr auto auto auto; padding: 12px 0; }
      .rule:first-of-type { border-top: 0; }
      .pill { border: 1px solid rgba(18,56,80,.16); color: #506578; font-size: 12px; padding: 4px 8px; text-transform: uppercase; }
      pre {
        background: #071827;
        color: #f7fbff;
        font-size: 12px;
        line-height: 1.45;
        margin: 14px 0 0;
        max-height: 520px;
        overflow: auto;
        padding: 16px;
      }
      code { font-family: "IBM Plex Sans", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .muted { color: #506578; font-size: 13px; }
      .loading { opacity: .64; }
      @media (max-width: 980px) {
        .grid, .summary-grid, .rule { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Trace local evidence demo.</h1>
      <p>Run an AI agent action through identity verification, policy evaluation, evidence generation, hashing, and signing stub output.</p>
    </header>
    <main>
      <section class="grid">
        <div class="panel">
          <h2>Payment draft above threshold</h2>
          <p>The fixture simulates <strong>accounts-payable-agent-17</strong> creating a <strong>$12,500</strong> payment draft. The policy threshold is <strong>$10,000</strong>.</p>
          <div class="actions">
            <button data-run="observe">Run observe mode</button>
            <button class="secondary" data-run="enforce">Run enforce mode</button>
            <button class="secondary" data-run="vendor">Run vendor modification denial</button>
          </div>
        </div>
        <div class="panel">
          <h3>What should happen?</h3>
          <p><strong>Observe</strong> records a high-severity flag and allows the action. <strong>Enforce</strong> blocks the same action and still emits evidence. The vendor fixture is denied by identity capability.</p>
        </div>
      </section>

      <section class="summary" id="summary">
        <h2>Result summary</h2>
        <p class="muted">Choose a scenario above to run Trace locally.</p>
      </section>

      <section class="ledger" id="ledger" hidden>
        <h2>Evaluation ledger</h2>
        <div id="rules"></div>
      </section>

      <section class="json-panel" id="jsonPanel" hidden>
        <h2>Evidence JSON</h2>
        <p class="muted">This is the schema-valid evidence record emitted by the local Trace runtime.</p>
        <pre id="json"></pre>
      </section>
    </main>
    <script>
      const buttons = document.querySelectorAll("[data-run]");
      const summary = document.getElementById("summary");
      const ledger = document.getElementById("ledger");
      const rules = document.getElementById("rules");
      const jsonPanel = document.getElementById("jsonPanel");
      const json = document.getElementById("json");

      const scenarios = {
        observe: "/trace/fixtures/payment-draft-above-threshold/run?mode=observe",
        enforce: "/trace/fixtures/payment-draft-above-threshold/run?mode=enforce",
        vendor: "/trace/fixtures/vendor-modification-denied/run?mode=observe"
      };

      buttons.forEach((button) => {
        button.addEventListener("click", async () => {
          await runScenario(button.dataset.run);
        });
      });

      async function runScenario(name) {
        summary.classList.add("loading");
        summary.innerHTML = "<h2>Running Trace...</h2><p class='muted'>Evaluating identity, policy, evidence, hash, and signing stub.</p>";
        const response = await fetch(scenarios[name], { method: "POST" });
        const result = await response.json();
        render(result);
      }

      function render(result) {
        const record = result.evidence_record;
        const triggered = record.evaluation_ledger.find((entry) => entry.result !== "pass") || record.evaluation_ledger[0];
        const statusClass = result.action_allowed ? (triggered.result === "flag" ? "flagged" : "allowed") : "blocked";
        summary.classList.remove("loading");
        summary.innerHTML = \`
          <h2>Result summary</h2>
          <div class="summary-grid">
            <div class="metric \${statusClass}"><span>Action</span><strong>\${result.action_allowed ? "Allowed" : "Blocked"}</strong></div>
            <div class="metric"><span>Mode</span><strong>\${result.mode}</strong></div>
            <div class="metric"><span>Rule</span><strong>\${triggered.rule_id}</strong></div>
            <div class="metric \${statusClass}"><span>Result</span><strong>\${triggered.result}</strong></div>
          </div>
          <p style="margin-top:16px">\${triggered.reason}</p>
          \${result.agent_response.error ? \`<pre>\${JSON.stringify(result.agent_response.error, null, 2)}</pre>\` : ""}
        \`;

        rules.innerHTML = record.evaluation_ledger.map((entry) => \`
          <div class="rule">
            <strong>\${entry.rule_id}</strong>
            <span class="pill">\${entry.rule_mode}</span>
            <span class="pill">\${entry.result}</span>
            <span class="pill">\${entry.severity}</span>
          </div>
        \`).join("");
        ledger.hidden = false;
        json.textContent = JSON.stringify(record, null, 2);
        jsonPanel.hidden = false;
      }
    </script>
  </body>
</html>`;
}
