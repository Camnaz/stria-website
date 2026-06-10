const SENSITIVE_KEYS = new Set(["account_number", "routing_number", "ssn", "tax_id", "token", "api_key", "authorization"]);

export function redactedPreview(args: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(args).reduce<Record<string, unknown>>((preview, [key, value]) => {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      preview[key] = "[REDACTED]";
      return preview;
    }

    if (typeof value === "string" && looksSensitive(value)) {
      preview[key] = "[REDACTED]";
      return preview;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      preview[key] = redactedPreview(value as Record<string, unknown>);
      return preview;
    }

    preview[key] = value;
    return preview;
  }, {});
}

function looksSensitive(value: string): boolean {
  return /bearer\s+[a-z0-9._-]+/i.test(value) || /sk-[a-z0-9_-]{12,}/i.test(value);
}
