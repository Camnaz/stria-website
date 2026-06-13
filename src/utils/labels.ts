const lowerCaseWords = new Set(["and", "or", "the", "to", "for", "of", "in", "with"]);
const preservedAcronyms = new Set(["AI", "API", "I/O", "LLM", "REST"]);

function toTitleWord(word: string, index: number) {
  if (preservedAcronyms.has(word)) return word;

  const normalized = word.toLowerCase();
  if (index > 0 && lowerCaseWords.has(normalized)) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatSectionLabel(label: string) {
  if (!label || label !== label.toUpperCase()) return label;

  return label
    .split(/(\s+|[→×/&.+-])/)
    .map((part, index) => {
      if (!/[A-Z]/.test(part)) return part;
      return toTitleWord(part, index);
    })
    .join("");
}
