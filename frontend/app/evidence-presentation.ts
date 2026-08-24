const MISSING_SOURCE_EVIDENCE = "Not separated in this brief.";

export type ConciseEvidencePreview = {
  headline: string;
  detail: string;
};

function shortenEvidence(value: string, maximumLength: number) {
  if (value.length <= maximumLength) return value;
  const lastSpace = value.lastIndexOf(" ", maximumLength);
  return `${value.slice(0, lastSpace > maximumLength / 2 ? lastSpace : maximumLength).trim()}…`;
}

export function conciseEvidencePreview(value: string): ConciseEvidencePreview {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized === MISSING_SOURCE_EVIDENCE) {
    return { headline: MISSING_SOURCE_EVIDENCE, detail: "" };
  }

  const clauses = normalized
    .split(
      /\s+[—–]\s+|;\s+|(?<=[.!?])\s+|,\s+(?=(?:and|but|while|return(?:s|ed)?|produc(?:e|es|ed)|convert(?:s|ed)?|report(?:s|ed)?|ask(?:s|ed)?|request(?:s|ed)?|need(?:s|ed)?|show(?:s|ed)?|identif(?:y|ies|ied))\b)/i,
    )
    .map((clause) => clause.trim())
    .filter(Boolean);

  const headline = shortenEvidence(clauses[0] || normalized, 72);
  const detailCandidate = clauses
    .slice(1)
    .find((clause) => /\d|%|\b(?:daily|weekly|monthly|annual|repeat|purchase intent)\b/i.test(clause))
    || clauses[1]
    || "";

  return {
    headline,
    detail: detailCandidate ? shortenEvidence(detailCandidate, 62) : "",
  };
}
