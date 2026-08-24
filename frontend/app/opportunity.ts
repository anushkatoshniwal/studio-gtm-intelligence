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

export type AssumptionType = "observed" | "working" | "unknown";

export type ExperimentRecommendation = {
  baselineConversion: number;
  baselineType: AssumptionType;
  expectedConversion: number;
  expectedOutcomeType: AssumptionType;
  rationale: string;
  pilotSize: number;
  evidenceConfidence: number;
  executionFeasibility: number;
  revenuePerCustomer: number;
  acquisitionCost: number;
  pilotCost: number;
  fixedTeamCost: number;
};

export type OpportunityParseResult =
  | {
      ok: true;
      context: OpportunityContext;
      recommendation?: ExperimentRecommendation;
    }
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
  evidenceSource?: keyof SourceEvidence;
};

export type SourceEvidence = {
  product: string;
  customer: string;
  market: string;
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

const SOURCE_EVIDENCE_HEADINGS: Record<string, keyof SourceEvidence> = {
  "product evidence": "product",
  "customer evidence": "customer",
  "market evidence": "market",
};

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

  for (const [name, evidenceSource] of Object.entries(SOURCE_EVIDENCE_HEADINGS)) {
    if (lower === name || lower === `${name}:`) {
      return {
        field: "supportingEvidence",
        inlineValue: "",
        sectionNumber,
        evidenceSource,
      };
    }

    for (const separator of [":", "—", "-"]) {
      const prefix = `${name}${separator}`;
      if (lower.startsWith(prefix)) {
        const inlineValue = normalized.slice(prefix.length).trim();
        if (inlineValue) {
          return {
            field: "supportingEvidence",
            inlineValue,
            sectionNumber,
            evidenceSource,
          };
        }
      }
    }
  }

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

type StructuredRecommendationPayload = Record<string, unknown>;

function structuredText(value: unknown) {
  if (typeof value === "string") return removePresentationArtifacts(value).trim();
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => removePresentationArtifacts(item).trim())
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function structuredNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function assumptionType(value: unknown): AssumptionType | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (["observed", "observed baseline", "evidence backed", "evidence backed estimate"].includes(normalized)) {
    return "observed";
  }
  if (["working", "working assumption", "assumption"].includes(normalized)) {
    return "working";
  }
  if (["unknown", "not established"].includes(normalized)) return "unknown";
  return null;
}

function balancedJsonObject(text: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, index + 1);
    }
  }
  return null;
}

function extractStructuredJson(text: string) {
  const fencedBlocks = text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi);
  for (const block of fencedBlocks) {
    const candidate = block[1].trim();
    if (candidate.startsWith("{") && candidate.includes('"baseline_conversion"')) {
      return candidate;
    }
  }

  for (let startIndex = text.indexOf("{"); startIndex >= 0; startIndex = text.indexOf("{", startIndex + 1)) {
    const candidate = balancedJsonObject(text, startIndex);
    if (
      candidate
      && candidate.includes('"opportunity"')
      && candidate.includes('"baseline_conversion"')
      && candidate.includes('"expected_conversion"')
    ) {
      return candidate;
    }
  }
  return null;
}

function parseStructuredRecommendation(
  text: string,
): OpportunityParseResult | null {
  const trimmed = text.trim();
  const embeddedJson = extractStructuredJson(trimmed);
  const looksStructured = Boolean(embeddedJson) || trimmed.startsWith("{");
  if (!looksStructured) return null;

  const jsonText = embeddedJson ?? trimmed;

  let payload: StructuredRecommendationPayload;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    payload = parsed as StructuredRecommendationPayload;
  } catch {
    return {
      ok: false,
      missing: [],
      error: "The structured experiment recommendation is not valid JSON.",
    };
  }

  const requiredText: [string, string][] = [
    ["opportunity", "Opportunity"],
    ["target_segment", "Target segment"],
    ["hypothesis", "Hypothesis"],
    ["primary_metric", "Primary metric"],
    ["rationale", "Rationale"],
  ];
  const missing = requiredText
    .filter(([field]) => !structuredText(payload[field]))
    .map(([, label]) => label);

  const evidencePayload = payload.key_evidence;
  const evidence = evidencePayload && typeof evidencePayload === "object" && !Array.isArray(evidencePayload)
    ? evidencePayload as Record<string, unknown>
    : {};
  const productEvidence = structuredText(evidence.product ?? payload.product_evidence);
  const customerEvidence = structuredText(evidence.customer ?? payload.customer_evidence);
  const marketEvidence = structuredText(evidence.market ?? payload.market_evidence);
  if (!productEvidence) missing.push("Product evidence");
  if (!customerEvidence) missing.push("Customer evidence");
  if (!marketEvidence) missing.push("Market evidence");

  const numericFields: [string, string, (value: number) => boolean][] = [
    ["baseline_conversion", "Baseline conversion", (value) => value >= 0 && value <= 1],
    ["expected_conversion", "Expected conversion", (value) => value >= 0 && value <= 1],
    ["pilot_size", "Pilot size", (value) => Number.isInteger(value) && value > 0],
    ["evidence_confidence", "Evidence confidence", (value) => Number.isInteger(value) && value >= 1 && value <= 5],
    ["execution_feasibility", "Execution feasibility", (value) => Number.isInteger(value) && value >= 1 && value <= 5],
    ["revenue_per_customer", "Revenue per customer", (value) => value >= 0],
    ["acquisition_cost", "Acquisition cost", (value) => value >= 0],
    ["pilot_cost", "Pilot cost", (value) => value >= 0],
    ["fixed_team_cost", "Fixed team cost", (value) => value >= 0],
  ];
  const numbers = Object.fromEntries(
    numericFields.map(([field]) => [field, structuredNumber(payload[field])]),
  ) as Record<string, number | null>;
  for (const [field, label, isValid] of numericFields) {
    const value = numbers[field];
    if (value === null || !isValid(value)) missing.push(label);
  }

  const baselineType = assumptionType(payload.baseline_type);
  const expectedOutcomeType = assumptionType(payload.expected_outcome_type);
  if (!baselineType) missing.push("Baseline type");
  if (!expectedOutcomeType) missing.push("Expected outcome type");

  if (missing.length) {
    return {
      ok: false,
      missing,
      error: `The structured recommendation is missing or has invalid fields: ${missing.join(", ")}.`,
    };
  }

  const keyUnknowns = structuredText(payload.key_unknowns);
  const keyRisks = structuredText(payload.key_risks);
  const context: OpportunityContext = {
    opportunity: structuredText(payload.opportunity),
    targetSegment: structuredText(payload.target_segment),
    hypothesis: structuredText(payload.hypothesis),
    primaryMetric: structuredText(payload.primary_metric),
    supportingEvidence: [
      `Product: ${productEvidence}`,
      `Customer: ${customerEvidence}`,
      `Market: ${marketEvidence}`,
    ].join("\n"),
    keyUnknowns,
    contradictingEvidence: keyRisks,
    whyNow: "",
    recommendedGtmMotion: "",
    expectedOutcome: "",
  };
  const recommendation: ExperimentRecommendation = {
    baselineConversion: numbers.baseline_conversion!,
    baselineType: baselineType!,
    expectedConversion: numbers.expected_conversion!,
    expectedOutcomeType: expectedOutcomeType!,
    rationale: structuredText(payload.rationale),
    pilotSize: numbers.pilot_size!,
    evidenceConfidence: numbers.evidence_confidence!,
    executionFeasibility: numbers.execution_feasibility!,
    revenuePerCustomer: numbers.revenue_per_customer!,
    acquisitionCost: numbers.acquisition_cost!,
    pilotCost: numbers.pilot_cost!,
    fixedTeamCost: numbers.fixed_team_cost!,
  };

  return { ok: true, context, recommendation };
}

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
  const structuredResult = parseStructuredRecommendation(text);
  if (structuredResult) return structuredResult;

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
      if (heading.evidenceSource) {
        const sourceLabel = heading.evidenceSource[0].toUpperCase()
          + heading.evidenceSource.slice(1);
        collected.supportingEvidence.push(`${sourceLabel}:`);
      }
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
