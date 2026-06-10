import type { AgentIdentity, AgentToolCall, EvaluationLedgerEntry, PolicyRule, PolicySpec, TraceMode } from "./types.js";

export function verifyIdentity(identity: AgentIdentity, call: AgentToolCall): EvaluationLedgerEntry[] {
  const allowed = identity.allowed_tool_capabilities.some(
    (capability) =>
      capability.namespace === call.tool_namespace &&
      capability.tool === call.tool_name &&
      capability.action === call.action,
  );

  if (allowed) {
    return [];
  }

  return [
    {
      policy_id: "identity",
      policy_version: identity.identity_version,
      rule_id: "identity-capability-denial",
      rule_mode: "enforce",
      result: "block",
      reason: `agent identity does not allow ${call.tool_namespace}.${call.tool_name}:${call.action}`,
      severity: "critical",
    },
  ];
}

export function evaluatePolicy(policy: PolicySpec, call: AgentToolCall): EvaluationLedgerEntry[] {
  return policy.rules.map((rule) => evaluateRule(policy, rule, call)).filter((entry): entry is EvaluationLedgerEntry => entry !== null);
}

function evaluateRule(policy: PolicySpec, rule: PolicyRule, call: AgentToolCall): EvaluationLedgerEntry | null {
  const mode = rule.mode ?? policy.global_mode;

  switch (rule.detector) {
    case "payment_threshold":
      return evaluatePaymentThreshold(policy, rule, mode, call);
    case "tool_forbidden":
      return evaluateForbiddenTool(policy, rule, mode, call);
    case "resource_delete":
      return evaluateResourceDeletion(policy, rule, mode, call);
    case "network_allowlist":
      return evaluateNetworkAllowlist(policy, rule, mode, call);
    case "managed_ai_usage_review":
      return evaluateManagedAiUsage(policy, rule, mode, call);
    case "pii":
      return containsPii(call.arguments) ? triggered(policy, rule, mode) : passed(policy, rule, mode);
    case "token_leakage":
      return containsTokenLeakage(call.arguments) ? triggered(policy, rule, mode) : passed(policy, rule, mode);
  }
}

function evaluateManagedAiUsage(policy: PolicySpec, rule: PolicyRule, mode: TraceMode, call: AgentToolCall): EvaluationLedgerEntry {
  const isManagedAiSearch = call.tool_namespace === "browser.web" && call.tool_name === "google.search";
  const riskLevel = String(call.arguments.risk_level ?? "low");
  const domainAlignment = String(call.arguments.domain_alignment ?? "adjacent");
  const shouldReview = isManagedAiSearch && (riskLevel === "high" || domainAlignment === "out_of_domain");

  if (!shouldReview) {
    return passed(policy, rule, mode);
  }

  return {
    policy_id: policy.policy_id,
    policy_version: policy.policy_version,
    rule_id: rule.id,
    rule_mode: mode,
    result: mode === "enforce" ? "block" : "flag",
    reason: rule.reason,
    severity: riskLevel === "high" ? "high" : "medium",
  };
}

function evaluatePaymentThreshold(policy: PolicySpec, rule: PolicyRule, mode: TraceMode, call: AgentToolCall): EvaluationLedgerEntry {
  const amount = Number(call.arguments.amount_usd ?? 0);
  const threshold = rule.threshold_usd ?? Number.POSITIVE_INFINITY;

  return amount > threshold ? triggered(policy, rule, mode) : passed(policy, rule, mode);
}

function evaluateForbiddenTool(policy: PolicySpec, rule: PolicyRule, mode: TraceMode, call: AgentToolCall): EvaluationLedgerEntry {
  const forbidden = rule.forbidden_tools?.some((tool) => tool.namespace === call.tool_namespace && tool.tool === call.tool_name) ?? false;
  return forbidden ? triggered(policy, rule, mode) : passed(policy, rule, mode);
}

function evaluateResourceDeletion(policy: PolicySpec, rule: PolicyRule, mode: TraceMode, call: AgentToolCall): EvaluationLedgerEntry {
  const deletion = call.action === "delete" && call.resources_modified.some((resource) => matchesAnyPattern(resource, rule.forbidden_resource_patterns ?? []));
  return deletion ? triggered(policy, rule, mode) : passed(policy, rule, mode);
}

function evaluateNetworkAllowlist(policy: PolicySpec, rule: PolicyRule, mode: TraceMode, call: AgentToolCall): EvaluationLedgerEntry {
  const allowed = rule.allowed_destinations?.includes(call.network_destination) ?? true;
  return allowed ? passed(policy, rule, mode) : triggered(policy, rule, mode);
}

function triggered(policy: PolicySpec, rule: PolicyRule, mode: TraceMode): EvaluationLedgerEntry {
  return {
    policy_id: policy.policy_id,
    policy_version: policy.policy_version,
    rule_id: rule.id,
    rule_mode: mode,
    result: mode === "enforce" ? "block" : "flag",
    reason: rule.reason,
    severity: rule.severity,
  };
}

function passed(policy: PolicySpec, rule: PolicyRule, mode: TraceMode): EvaluationLedgerEntry {
  return {
    policy_id: policy.policy_id,
    policy_version: policy.policy_version,
    rule_id: rule.id,
    rule_mode: mode,
    result: "pass",
    reason: "rule did not trigger",
    severity: "info",
  };
}

function containsPii(value: unknown): boolean {
  return JSON.stringify(value).match(/\b\d{3}-\d{2}-\d{4}\b/) !== null;
}

function containsTokenLeakage(value: unknown): boolean {
  return JSON.stringify(value).match(/bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}/i) !== null;
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`);
    return regex.test(value);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
