import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256 } from "./hash.js";
import type {
  AgentToolCall,
  RuleResult,
  SimulationResult,
  StoredTraceEvent,
  TraceAnalytics,
  TraceIngestEnvelope,
  TraceModelResponse,
  TraceReplay,
  TraceSessionSummary,
} from "./types.js";

export class TraceLocalStore {
  private db: DatabaseSync;
  readonly databasePath: string;

  constructor(databasePath = defaultDatabasePath()) {
    this.databasePath = databasePath;
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      create table if not exists trace_events (
        event_id text primary key,
        sequence integer not null,
        tenant_id text not null,
        project_id text not null,
        user_id text not null,
        session_id text not null,
        source text not null,
        tags_json text not null,
        ingested_at text not null,
        call_json text not null,
        response_json text,
        result_json text not null
      );
      create index if not exists idx_trace_events_scope on trace_events (tenant_id, project_id, user_id, session_id);
      create index if not exists idx_trace_events_session_sequence on trace_events (session_id, sequence);
    `);
    this.ensureColumn("trace_events", "response_json", "response_json text");
  }

  ingest(envelope: TraceIngestEnvelope, result: SimulationResult, ingestedAt = new Date().toISOString()): StoredTraceEvent {
    const sequence = this.nextSequence(envelope.session_id);
    const response = envelope.response ? normalizeResponse(envelope.response) : null;
    const event: StoredTraceEvent = {
      event_id: `evt_${envelope.session_id}_${String(sequence).padStart(4, "0")}`,
      sequence,
      tenant_id: envelope.tenant_id,
      project_id: envelope.project_id,
      user_id: envelope.user_id,
      session_id: envelope.session_id,
      source: envelope.source,
      tags: envelope.tags ?? [],
      ingested_at: ingestedAt,
      call: envelope.call,
      response,
      result,
    };

    this.db
      .prepare(
        `insert into trace_events (
          event_id,
          sequence,
          tenant_id,
          project_id,
          user_id,
          session_id,
          source,
          tags_json,
          ingested_at,
          call_json,
          response_json,
          result_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.event_id,
        event.sequence,
        event.tenant_id,
        event.project_id,
        event.user_id,
        event.session_id,
        event.source,
        JSON.stringify(event.tags),
        event.ingested_at,
        JSON.stringify(event.call),
        JSON.stringify(event.response),
        JSON.stringify(event.result),
      );

    return event;
  }

  previousRecordHash(sessionId: string): string | null {
    const previous = this.db
      .prepare("select result_json from trace_events where session_id = ? order by sequence desc limit 1")
      .get(sessionId) as TraceEventRow | undefined;

    if (!previous) {
      return null;
    }

    const result = JSON.parse(previous.result_json) as SimulationResult;
    return result.evidence_record.chain_of_custody.record_hash;
  }

  list(filters: TraceStoreFilters = {}): StoredTraceEvent[] {
    return this.rows(filters).map(rowToStoredEvent);
  }

  replay(sessionId: string): TraceReplay {
    const events = this.list({ session_id: sessionId }).sort((a, b) => a.sequence - b.sequence);
    const first = events[0] ?? null;
    const last = events.at(-1) ?? null;

    return {
      tenant_id: first?.tenant_id ?? "",
      project_id: first?.project_id ?? "",
      user_id: first?.user_id ?? "",
      session_id: sessionId,
      event_count: events.length,
      first_seen_at: first?.ingested_at ?? null,
      last_seen_at: last?.ingested_at ?? null,
      summary: summarizeSession(events),
      events,
    };
  }

  analytics(filters: TraceStoreFilters = {}): TraceAnalytics {
    const events = this.list(filters);
    const sessions = new Set(events.map((event) => event.session_id));
    const users = new Set(events.map((event) => event.user_id));
    const riskCounts: Record<string, number> = {};
    const intentCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    const opportunities = new Set<string>();

    for (const event of events) {
      const preview = event.result.evidence_record.action_payload.redacted_arguments_preview;
      const risk = stringOrNull(preview.risk_level) ?? "unclassified";
      const intent = stringOrNull(preview.intent_classification) ?? "unclassified";
      riskCounts[risk] = (riskCounts[risk] ?? 0) + 1;
      intentCounts[intent] = (intentCounts[intent] ?? 0) + 1;
      userCounts[event.user_id] = (userCounts[event.user_id] ?? 0) + 1;
      for (const opportunity of opportunitiesForEvent(event)) {
        opportunities.add(opportunity);
      }
    }

    return {
      tenant_id: filters.tenant_id ?? null,
      project_id: filters.project_id ?? null,
      total_events: events.length,
      total_sessions: sessions.size,
      total_users: users.size,
      allowed_actions: events.filter((event) => event.result.action_allowed).length,
      blocked_actions: events.filter((event) => !event.result.action_allowed).length,
      flagged_events: events.filter((event) => event.result.evidence_record.evaluation_ledger.some((entry) => entry.result === "flag")).length,
      llm_usage_events: events.filter((event) => event.result.evidence_record.action_payload.redacted_arguments_preview.llm_usage_detected === true).length,
      response_events: events.filter((event) => event.response !== null).length,
      total_input_tokens: events.reduce((sum, event) => sum + (event.response?.input_tokens ?? 0), 0),
      total_output_tokens: events.reduce((sum, event) => sum + (event.response?.output_tokens ?? 0), 0),
      risk_counts: riskCounts,
      intent_counts: intentCounts,
      improvement_opportunities: [...opportunities],
      top_users: Object.entries(userCounts)
        .map(([user_id, count]) => ({ user_id, events: count }))
        .sort((a, b) => b.events - a.events),
      recent_events: events.slice(-10).reverse().map((event) => {
        const preview = event.result.evidence_record.action_payload.redacted_arguments_preview;
        const triggered = event.result.evidence_record.evaluation_ledger.find((entry) => entry.result !== "pass");

        return {
          event_id: event.event_id,
          session_id: event.session_id,
          user_id: event.user_id,
          query: stringOrNull(preview.query),
          intent: stringOrNull(preview.intent_classification),
          risk: stringOrNull(preview.risk_level),
          response_preview: event.response?.redacted_preview ?? null,
          result: (triggered?.result ?? "pass") as RuleResult,
          record_hash: event.result.evidence_record.chain_of_custody.record_hash,
        };
      }),
    };
  }

  reset() {
    this.db.exec("delete from trace_events");
  }

  close() {
    this.db.close();
  }

  private nextSequence(sessionId: string): number {
    const row = this.db.prepare("select coalesce(max(sequence), 0) as max_sequence from trace_events where session_id = ?").get(sessionId) as
      | { max_sequence: number }
      | undefined;
    return Number(row?.max_sequence ?? 0) + 1;
  }

  private rows(filters: TraceStoreFilters) {
    const clauses: string[] = [];
    const values: string[] = [];

    for (const key of ["tenant_id", "project_id", "user_id", "session_id"] as const) {
      if (filters[key]) {
        clauses.push(`${key} = ?`);
        values.push(filters[key]);
      }
    }

    const where = clauses.length > 0 ? ` where ${clauses.join(" and ")}` : "";
    return this.db.prepare(`select * from trace_events${where} order by ingested_at asc, sequence asc`).all(...values) as unknown as TraceEventRow[];
  }

  private ensureColumn(tableName: string, columnName: string, columnDefinition: string) {
    const columns = this.db.prepare(`pragma table_info(${tableName})`).all() as unknown as Array<{ name: string }>;
    if (!columns.some((column) => column.name === columnName)) {
      this.db.exec(`alter table ${tableName} add column ${columnDefinition}`);
    }
  }
}

export interface TraceStoreFilters {
  tenant_id?: string;
  project_id?: string;
  user_id?: string;
  session_id?: string;
}

export const traceLocalStore = new TraceLocalStore();

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function defaultDatabasePath() {
  if (process.env.TRACE_DB_PATH) {
    return process.env.TRACE_DB_PATH;
  }

  if (process.env.VITEST_WORKER_ID) {
    return join(".trace", `trace-test-${process.pid}-${process.env.VITEST_WORKER_ID}.sqlite`);
  }

  return join(".trace", "trace-local.sqlite");
}

interface TraceEventRow {
  event_id: string;
  sequence: number;
  tenant_id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  source: TraceIngestEnvelope["source"];
  tags_json: string;
  ingested_at: string;
  call_json: string;
  response_json: string | null;
  result_json: string;
}

function rowToStoredEvent(row: TraceEventRow): StoredTraceEvent {
  return {
    event_id: row.event_id,
    sequence: row.sequence,
    tenant_id: row.tenant_id,
    project_id: row.project_id,
    user_id: row.user_id,
    session_id: row.session_id,
    source: row.source,
    tags: JSON.parse(row.tags_json) as string[],
    ingested_at: row.ingested_at,
    call: JSON.parse(row.call_json) as AgentToolCall,
    response: row.response_json ? (JSON.parse(row.response_json) as TraceModelResponse | null) : null,
    result: JSON.parse(row.result_json) as SimulationResult,
  };
}

function normalizeResponse(response: TraceModelResponse): TraceModelResponse {
  return {
    ...response,
    redacted_preview: response.redacted_preview ?? redactResponsePreview(response.content),
    response_hash: response.response_hash ?? sha256(response.content),
  };
}

function redactResponsePreview(content: string) {
  return content
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]")
    .replace(/\b(?:sk|pk)-[a-z0-9_-]{8,}\b/gi, "[REDACTED_TOKEN]")
    .slice(0, 360);
}

function summarizeSession(events: StoredTraceEvent[]): TraceSessionSummary {
  const policyResults = events.reduce<Record<RuleResult, number>>(
    (counts, event) => {
      const triggered = event.result.evidence_record.evaluation_ledger.find((entry) => entry.result !== "pass");
      const result = (triggered?.result ?? "pass") as RuleResult;
      counts[result] += 1;
      return counts;
    },
    { pass: 0, flag: 0, block: 0 },
  );
  const risks = events.map((event) => event.result.evidence_record.action_payload.redacted_arguments_preview.risk_level).filter((risk): risk is string => typeof risk === "string");
  const riskLevel = risks.includes("high") ? "high" : risks.includes("medium") ? "medium" : risks.includes("low") ? "low" : "none";
  const responseEvents = events.filter((event) => event.response !== null).length;
  const opportunities = [...new Set(events.flatMap(opportunitiesForEvent))];

  return {
    headline: `${events.length} event${events.length === 1 ? "" : "s"} replayed; ${policyResults.flag} flagged, ${policyResults.block} blocked, ${responseEvents} with model responses.`,
    narrative:
      events.length === 0
        ? "No events have been captured for this session yet."
        : `Trace captured the session under one custody chain, evaluated each action, and retained ${responseEvents} model response preview${responseEvents === 1 ? "" : "s"} for operator review.`,
    risk_level: riskLevel as TraceSessionSummary["risk_level"],
    policy_results: policyResults,
    improvement_opportunities: opportunities,
  };
}

function opportunitiesForEvent(event: StoredTraceEvent): string[] {
  const preview = event.result.evidence_record.action_payload.redacted_arguments_preview;
  const opportunities: string[] = [];

  if (preview.risk_level === "high") {
    opportunities.push("Create a high-risk AI usage review workflow with security/compliance ownership.");
  }

  if (preview.domain_alignment === "out_of_domain") {
    opportunities.push("Clarify acceptable-use boundaries and show just-in-time guidance for out-of-domain prompts.");
  }

  if (event.response && event.response.finish_reason === "length") {
    opportunities.push("Tune model response limits or summarization prompts to avoid truncated outputs.");
  }

  if (event.response && event.response.output_tokens && event.response.output_tokens > 800) {
    opportunities.push("Review long responses for summarization or retrieval quality improvements.");
  }

  if (event.result.evidence_record.evaluation_ledger.some((entry) => entry.result === "flag")) {
    opportunities.push("Review flagged usage patterns and decide whether any observe-mode rules should move to enforce mode.");
  }

  return opportunities;
}
