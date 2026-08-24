export const OPPORTUNITY_FIELDS = [
  "opportunity",
  "targetSegment",
  "whyNow",
  "supportingEvidence",
  "contradictingEvidence",
  "keyUnknowns",
  "recommendedGtmMotion",
  "hypothesis",
  "expectedOutcome",
  "primaryMetric",
] as const;

export type OpportunityField = (typeof OPPORTUNITY_FIELDS)[number];

export type OpportunityContext = Record<OpportunityField, string>;

export type OpportunityParseResult =
  | { ok: true; context: OpportunityContext }
  | { ok: false; missing: string[]; error?: string };

export type OpportunityParseFailure = Extract<
  OpportunityParseResult,
  { ok: false }
>;

const MULTIPLE_PRIMARY_OPPORTUNITIES_ERROR =
  "Multiple primary opportunities detected. Please provide one primary opportunity and place additional opportunities under 'Other opportunities'.";

const SECTION_LABELS: Record<OpportunityField, string> = {
  opportunity: "Opportunity",
  targetSegment: "Target segment",
  whyNow: "Why now",
  supportingEvidence: "Supporting evidence",
  contradictingEvidence: "Contradicting evidence",
  keyUnknowns: "Key unknowns",
  recommendedGtmMotion: "Recommended GTM motion",
  hypothesis: "Experiment hypothesis",
  expectedOutcome: "Expected outcome",
  primaryMetric: "Primary metric",
};

const SECTION_ALIASES: Record<OpportunityField, string[]> = {
  opportunity: ["Opportunity"],
  targetSegment: ["Target segment", "Audience", "Who is this for?", "Who is this for"],
  whyNow: ["Why now"],
  supportingEvidence: [
    "Supporting evidence",
    "Evidence summary",
    "Evidence highlights",
    "Why promising",
    "Why test this?",
    "Why test this",
  ],
  contradictingEvidence: [
    "Contradicting evidence",
    "Contradictions",
  ],
  keyUnknowns: ["Key unknowns", "Unknowns", "What could make us wrong?", "What could make us wrong"],
  recommendedGtmMotion: [
    "Recommended GTM motion",
    "Recommended motion",
  ],
  hypothesis: ["Experiment hypothesis", "Hypothesis", "What should we test?", "What should we test"],
  expectedOutcome: ["Expected outcome", "Outcome"],
  primaryMetric: ["Primary metric"],
};

type HeadingMatch = {
  field: OpportunityField;
  inlineValue: string;
  sectionNumber: number | null;
};

const REQUIRED_FIELDS: OpportunityField[] = [
  "opportunity",
  "targetSegment",
  "hypothesis",
  "primaryMetric",
];

const REQUIRED_FIELD_LABELS: Partial<Record<OpportunityField, string>> = {
  opportunity: "Opportunity",
  targetSegment: "Target segment",
  hypothesis: "Hypothesis",
  primaryMetric: "Primary metric",
};

const CANONICAL_HEADINGS = OPPORTUNITY_FIELDS.flatMap((field) =>
  SECTION_ALIASES[field].map((name) => ({
    field,
    name: name.toLowerCase(),
  })),
);

const EMBEDDED_BOLD_BOUNDARY_NAMES = [
  "Opportunity",
  "Target segment",
  "Hypothesis",
  "Primary metric",
  "Other opportunities",
].join("|");

function normalizeInputSectionBoundaries(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    // Work Agent copy can omit the newline between prose and a Markdown
    // heading (`complete picture.### Opportunity`). Restore that structural
    // boundary before any section lookup.
    .replace(/([^#\n])(?=#{1,6}[ \t]*)/g, "$1\n")
    // Do the same for canonical bold labels when they are attached to prose.
    .replace(
      new RegExp(
        `([^\\n])(?=\\*\\*(?:${EMBEDDED_BOLD_BOUNDARY_NAMES})(?::\\*\\*|\\*\\*:))`,
        "gi",
      ),
      "$1\n",
    );
}

function normalizeHeadingLine(line: string) {
  let normalized = line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^#{1,6}\s*/, "")
    .trim();

  const numberMatch = normalized.match(/^(\d{1,2})\s*[.)]\s*/);
  const sectionNumber = numberMatch ? Number(numberMatch[1]) : null;
  if (numberMatch) normalized = normalized.slice(numberMatch[0].length);

  // Formatting markers are not part of a canonical section name. Removing
  // them also supports forms such as `### **1. Opportunity**` and
  // `### 1. **Opportunity**` without weakening the name match itself.
  normalized = normalized
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .trim();

  return { normalized, sectionNumber };
}

function normalizedBoundaryName(line: string) {
  return normalizeHeadingLine(line).normalized
    .toLowerCase()
    .replace(/:$/, "")
    .trim();
}

function matchHeading(line: string): HeadingMatch | null {
  const { normalized, sectionNumber } = normalizeHeadingLine(line);
  const lower = normalized.toLowerCase();

  for (const { field, name } of CANONICAL_HEADINGS) {
    if (lower === name || lower === `${name}:`) {
      return { field, inlineValue: "", sectionNumber };
    }

    for (const separator of [":", "—", "-"]) {
      const prefix = `${name}${separator}`;
      if (lower.startsWith(prefix)) {
        const inlineValue = normalized.slice(prefix.length).trim();
        if (inlineValue) {
          return { field, inlineValue, sectionNumber };
        }
      }
    }
  }

  return null;
}

function removePresentationArtifacts(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s*\[(?:\d+(?:\s*[-,]\s*\d+)*|[A-Za-z][A-Za-z0-9_-]*[:#-]?\d+[A-Za-z0-9:_-]*)\]\s*/g, " ")
    .replace(/\s*【[^】]*\d[^】]*】\s*/g, " ")
    .replace(/\s*\((?:source|citation|signal)s?\s*[:#][^)]+\)\s*/gi, " ")
    .replace(/\s*\[cite:[^\]]+\]\s*/gi, " ")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*["“”](?=\S)/gm, "")
    .replace(/(?<=\S)["“”]\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function removeRepeatedClaims(value: string) {
  const seen = new Set<string>();
  return value
    .split(/\n+|(?<=[.!?])\s+/)
    .map((claim) => claim.trim())
    .filter((claim) => {
      if (!claim) return false;
      const normalized = claim.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join("\n");
}

function cleanValue(lines: string[]) {
  const value = lines
    .join("\n")
    .trim()
    .replace(/^\s*[-*+•]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n");

  return removeRepeatedClaims(removePresentationArtifacts(value));
}

export type SourceEvidence = {
  product: string;
  customer: string;
  market: string;
};

export const MISSING_SOURCE_EVIDENCE = "Not separated in this brief.";

export function extractSourceEvidence(value: string): SourceEvidence {
  const evidence: Record<keyof SourceEvidence, string[]> = {
    product: [],
    customer: [],
    market: [],
  };
  let activeSource: keyof SourceEvidence | null = null;

  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const sourceMatch = line.match(/^(product|customer|market)\s*:\s*(.*)$/i);
    if (sourceMatch) {
      activeSource = sourceMatch[1].toLowerCase() as keyof SourceEvidence;
      if (sourceMatch[2].trim()) evidence[activeSource].push(sourceMatch[2].trim());
      continue;
    }
    if (activeSource) evidence[activeSource].push(line);
  }

  return {
    product: cleanValue(evidence.product),
    customer: cleanValue(evidence.customer),
    market: cleanValue(evidence.market),
  };
}

export function sourceEvidenceForDisplay(value: string): SourceEvidence {
  const evidence = extractSourceEvidence(value);
  return {
    product: evidence.product || MISSING_SOURCE_EVIDENCE,
    customer: evidence.customer || MISSING_SOURCE_EVIDENCE,
    market: evidence.market || MISSING_SOURCE_EVIDENCE,
  };
}

export function opportunityParseErrorMessage(result: OpportunityParseFailure) {
  if (result.error) return result.error;
  if (result.missing.length === 1) {
    return `Missing required field: ${result.missing[0]}.`;
  }
  return `Missing required fields: ${result.missing.join(", ")}.`;
}

export function parseGtmOpportunity(text: string): OpportunityParseResult {
  const collected = Object.fromEntries(
    OPPORTUNITY_FIELDS.map((field) => [field, [] as string[]]),
  ) as Record<OpportunityField, string[]>;
  let activeField: OpportunityField | null = null;
  const preamble: string[] = [];
  let hasSeenHeading = false;
  let primaryMetricParagraphEnded = false;
  const allLines = normalizeInputSectionBoundaries(text).split("\n");
  const boundaryIndexes = ["other opportunities", "end decision brief"]
    .map((boundary) => allLines.findIndex(
      (line) => normalizedBoundaryName(line) === boundary,
    ))
    .filter((index) => index >= 0);
  const primaryBoundaryIndex = boundaryIndexes.length
    ? Math.min(...boundaryIndexes)
    : -1;
  const primaryRegionLines = primaryBoundaryIndex >= 0
    ? allLines.slice(0, primaryBoundaryIndex)
    : allLines;
  const primaryOpportunityCount = primaryRegionLines.filter(
    (line) => matchHeading(line)?.field === "opportunity",
  ).length;
  if (primaryOpportunityCount > 1) {
    return {
      ok: false,
      missing: [],
      error: MULTIPLE_PRIMARY_OPPORTUNITIES_ERROR,
    };
  }
  // A copied Agent response may contain arbitrary prose before either a
  // Markdown Opportunity heading or an inline `Opportunity: ...` label. The
  // first canonical Opportunity boundary starts the primary brief; secondary
  // opportunities are excluded by the `Other opportunities` boundary below.
  const primaryOpportunityIndex = primaryRegionLines.findIndex(
    (line) => matchHeading(line)?.field === "opportunity",
  );
  const inputLines = primaryOpportunityIndex >= 0
    ? primaryRegionLines.slice(primaryOpportunityIndex)
    : primaryRegionLines;

  for (const line of inputLines) {
    const normalizedLine = normalizedBoundaryName(line);
    if (
      normalizedLine === "other opportunities" ||
      normalizedLine === "end decision brief"
    ) break;

    const heading = matchHeading(line);
    if (heading) {
      // The concise Agent brief labels the sentence beneath Expected outcome
      // as `Hypothesis: ...`. When the actual hypothesis has already been
      // collected, that inline label is outcome content rather than a second
      // hypothesis section.
      if (
        activeField === "expectedOutcome" &&
        heading.field === "hypothesis" &&
        heading.inlineValue &&
        !cleanValue(collected.expectedOutcome) &&
        cleanValue(collected.hypothesis)
      ) {
        collected.expectedOutcome.push(line);
        continue;
      }

      // Some copied Agent responses omit only the first heading while retaining
      // the numbered sequence from section 2 onward. The explicit `2. Target
      // segment` boundary makes the preceding text unambiguously section 1;
      // unnumbered preamble is never assigned automatically.
      if (
        !hasSeenHeading &&
        heading.field === "targetSegment" &&
        heading.sectionNumber === 2 &&
        cleanValue(preamble)
      ) {
        collected.opportunity.push(...preamble);
      }
      hasSeenHeading = true;
      activeField = heading.field;
      primaryMetricParagraphEnded = false;
      if (heading.inlineValue) collected[activeField].push(heading.inlineValue);
      continue;
    }
    if (!line.trim()) {
      if (activeField === "primaryMetric" && cleanValue(collected.primaryMetric)) {
        primaryMetricParagraphEnded = true;
      } else if (activeField) {
        collected[activeField].push(line);
      } else {
        preamble.push(line);
      }
      continue;
    }
    if (activeField === "primaryMetric" && primaryMetricParagraphEnded) {
      break;
    }
    if (activeField) {
      collected[activeField].push(line);
    } else {
      preamble.push(line);
    }
  }

  const context = Object.fromEntries(
    OPPORTUNITY_FIELDS.map((field) => [field, cleanValue(collected[field])]),
  ) as OpportunityContext;
  const missing = REQUIRED_FIELDS
    .filter((field) => !context[field])
    .map((field) => REQUIRED_FIELD_LABELS[field] || SECTION_LABELS[field]);

  return missing.length ? { ok: false, missing } : { ok: true, context };
}
