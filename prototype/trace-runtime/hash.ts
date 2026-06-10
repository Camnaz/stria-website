import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function sha256(value: unknown): string {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortForCanonicalJson(source[key]);
        return sorted;
      }, {});
  }

  return value;
}
