export interface UsageIntelligence {
  llm_usage_detected: boolean;
  llm_surface: string;
  intent_classification: string;
  domain_alignment: "in_domain" | "adjacent" | "out_of_domain";
  risk_level: "low" | "medium" | "high";
  risk_signals: string[];
  operator_narrative: string;
  recommended_workflow: string;
}

const BUSINESS_TERMS = [
  "agent",
  "ai",
  "approval",
  "audit",
  "compliance",
  "contract",
  "customer",
  "evidence",
  "finance",
  "invoice",
  "legal",
  "payment",
  "policy",
  "refund",
  "renewal",
  "risk",
  "security",
  "support",
  "vendor",
  "workflow",
];

const UNSAFE_SECURITY_PATTERN = /\b(hack|steal|phish|phishing|malware|ransomware|bypass|jailbreak|prompt injection|ignore previous|credential|credentials|keylogger|exploit|evade|exfiltrate|data exfiltration|sql injection|credential stuffing|delete logs|disable logging|cover tracks|backdoor|privilege escalation)\b/;
const INSIDER_RISK_PATTERN = /\b(sabotage|sabotaging|harm my company|hurt my employer|damage my employer|damage my company|disrupt company operations|take down company systems|destroy company data|leak confidential|leak company data|retaliate against my employer|retaliate against my company|insider threat)\b/;
const DEFENSIVE_SECURITY_PATTERN = /\b(detect|prevent|defend|defense|training|awareness|policy|incident response|security review|monitor|mitigate|protect|audit)\b/;
const PERSONAL_USE_PATTERN = /\b(resume|dating|sports betting|gambling|celebrity gossip|movie streaming|personal vacation)\b/;
const ACADEMIC_INTEGRITY_PATTERN = /\b(write my|do my|complete my|cannot detect ai|undetectable ai|cheat|plagiarize)\b.*\b(essay|exam|assignment|homework|teacher|university|school)\b|\b(essay|exam|assignment|homework|teacher|university|school)\b.*\b(write my|do my|complete my|cannot detect ai|undetectable ai|cheat|plagiarize)\b/;
const POLICY_VIOLATION_PATTERN = /\b(without human approval|without manager approval|without approval|without change approval|modify vendor payment|production database deletion|delete production|external summarizer|outside allowed network|supervisor signature|above 10000|above threshold)\b/;
const TRACE_PLANE_PATTERN = /\b(data plane|control plane|trust plane|merkle root|evidence record|evidence hash|agent identity|policy owner|audit-ready evidence|control evidence|review bottleneck|over restrictive|ciso|general counsel|compliance|ai platform team)\b/;
const GOVERNANCE_REVIEW_PATTERN = /\b(ciso|general counsel|compliance|policy owner|audit-ready|control evidence|agents? violated|data deletion policy|review bottlenecks?|ai platform team)\b/;

export function analyzeUsageIntent(query: string): UsageIntelligence {
  const normalized = query.toLowerCase();
  const riskSignals: string[] = [];
  const intent = classifySearchIntent(query);

  if (INSIDER_RISK_PATTERN.test(normalized)) {
    riskSignals.push("insider_threat_or_sabotage_intent");
  }

  if (UNSAFE_SECURITY_PATTERN.test(normalized) && !DEFENSIVE_SECURITY_PATTERN.test(normalized)) {
    riskSignals.push("potentially_malicious_security_intent");
  }

  if (UNSAFE_SECURITY_PATTERN.test(normalized) && DEFENSIVE_SECURITY_PATTERN.test(normalized)) {
    riskSignals.push("defensive_security_review_context");
  }

  if (PERSONAL_USE_PATTERN.test(normalized)) {
    riskSignals.push("likely_unrelated_personal_use");
  }

  if (ACADEMIC_INTEGRITY_PATTERN.test(normalized)) {
    riskSignals.push("possible_academic_integrity_violation");
  }

  if (POLICY_VIOLATION_PATTERN.test(normalized)) {
    riskSignals.push("policy_violation_or_approval_gap");
  }

  if (/\b(api keys?|password|secret|tokens?|bearer tokens?|access tokens?|customer data|company data|confidential company data|confidential data|ssn|social security|credit card|account number|account numbers|private data|private key|ssh key)\b/.test(normalized)) {
    riskSignals.push("possible_sensitive_data_exposure");
  }

  const domainAlignment = classifyDomainAlignment(normalized, intent, riskSignals);
  const riskLevel = riskSignals.some((signal) => signal.includes("malicious") || signal.includes("sensitive") || signal.includes("policy_violation") || signal.includes("insider_threat"))
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
    recommended_workflow: recommendedWorkflow(intent, domainAlignment, riskLevel),
  };
}

export function classifySearchIntent(query: string) {
  const normalized = query.toLowerCase();

  if (PERSONAL_USE_PATTERN.test(normalized)) {
    return "general_research";
  }

  if (INSIDER_RISK_PATTERN.test(normalized)) {
    return "potentially_malicious_or_unsafe";
  }

  if (UNSAFE_SECURITY_PATTERN.test(normalized) && !DEFENSIVE_SECURITY_PATTERN.test(normalized)) {
    return "potentially_malicious_or_unsafe";
  }

  if (UNSAFE_SECURITY_PATTERN.test(normalized) && DEFENSIVE_SECURITY_PATTERN.test(normalized)) {
    return "technical_workflow";
  }

  if (/\b(student|school|university|assignment|homework|exam|essay|teacher|academic)\b/.test(normalized)) {
    return "education_workflow";
  }

  if (TRACE_PLANE_PATTERN.test(normalized) || GOVERNANCE_REVIEW_PATTERN.test(normalized) || POLICY_VIOLATION_PATTERN.test(normalized)) {
    return "business_sensitive_workflow";
  }

  if (/\b(api|code|script|debug|error|deploy|database|schema|github|terminal|typescript|webhook|queue|incident response|security review|cloud|admin console|production)\b/.test(normalized)) {
    return "technical_workflow";
  }

  if (/^\s*(what is\s*)?-?\d+(?:\.\d+)?\s*(?:x|\*|×|\+|-|\/)\s*-?\d+(?:\.\d+)?\b/.test(normalized)) {
    return "general_research";
  }

  if (/\b(agent|ai|evidence|invoice|payment|vendor|contract|legal|policy|compliance|audit|risk|customer|refund|support|renewal|approval|exception|workflow|quote|sales|procurement)\b/.test(normalized)) {
    return "business_sensitive_workflow";
  }

  return "general_research";
}

function classifyDomainAlignment(query: string, intent: string, riskSignals: string[]): UsageIntelligence["domain_alignment"] {
  if (riskSignals.includes("likely_unrelated_personal_use")) return "out_of_domain";
  if (intent === "potentially_malicious_or_unsafe") return "out_of_domain";
  if (intent === "education_workflow") return "adjacent";
  if (BUSINESS_TERMS.some((term) => query.includes(term))) return "in_domain";
  if (intent === "technical_workflow") return "adjacent";
  return "adjacent";
}

function narrativeFor(intent: string, alignment: string, risk: string, signals: string[]) {
  if (intent === "potentially_malicious_or_unsafe") {
    if (signals.includes("insider_threat_or_sabotage_intent")) {
      return "The query resembles adverse insider intent. Trace should preserve evidence, avoid providing operational harm guidance, and route the event for security or compliance review.";
    }
    return "The query resembles unsafe or malicious security research. Trace should preserve evidence and route the event for security review.";
  }

  if (signals.includes("possible_sensitive_data_exposure")) {
    return "The query may include sensitive material. Trace should retain evidence and prompt an operator to review data exposure risk.";
  }

  if (alignment === "out_of_domain") {
    return "The query appears unrelated to approved business or academic workflows. Trace should record the usage pattern for policy review.";
  }

  if (intent === "business_sensitive_workflow") {
    return "The query appears tied to business-sensitive work. Trace should preserve evidence and help operators evaluate whether policy or human review applies.";
  }

  if (intent === "technical_workflow") {
    return "The query appears tied to technical work. Trace can help identify repeated troubleshooting patterns, tool usage, and workflow friction.";
  }

  if (intent === "education_workflow") {
    return "The query appears tied to academic work. Trace can help administrators apply acceptable-use or academic-integrity policies.";
  }

  return "The query appears to be general research. Trace records a baseline event and keeps the evidence available for later review.";
}

function recommendedWorkflow(intent: string, alignment: string, risk: string) {
  if (risk === "high") return "Route to security or compliance review and retain evidence.";
  if (alignment === "out_of_domain") return "Record as out-of-domain usage and review against acceptable-use policy.";
  if (intent === "business_sensitive_workflow") return "Retain evidence and review if sensitive business data appears.";
  if (intent === "technical_workflow") return "Aggregate with developer workflow signals and inspect repeated friction.";
  if (intent === "education_workflow") return "Review against institution-specific acceptable-use policy.";
  return "Record baseline usage and continue observing.";
}
