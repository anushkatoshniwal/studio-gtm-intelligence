"use client";

import { FormEvent, useState } from "react";
import {
  AssumptionType,
  OpportunityContext,
  opportunityParseErrorMessage,
  parseGtmOpportunity,
  sourceEvidenceForDisplay,
} from "./opportunity";
import { conciseEvidencePreview } from "./evidence-presentation";

type FormValues = {
  pilot_size: string;
  current_conversion_rate: string;
  expected_conversion_rate: string;
  revenue_per_customer: string;
  acquisition_cost: string;
  pilot_cost: string;
  fixed_team_cost: string;
  expansion_revenue_per_customer: string;
  evidence_confidence: string;
  feasibility: string;
};

type SimulationResult = {
  incremental_customers: number;
  incremental_revenue: number;
  total_incremental_cost: number;
  incremental_roi: number | null;
  break_even_incremental_customers: number | null;
  break_even_expected_conversion_rate: number | null;
  decision: "GO" | "REVIEW" | "NO-GO";
  reasons: string[];
  risks: string[];
};

type BaselineType = AssumptionType;

const EXPERIMENT_CONTEXT: OpportunityContext = {
  opportunity:
    "Collaborative review + predictable pricing for media agencies running multilingual localization campaigns.",
  targetSegment:
    "Media agencies running multilingual localization campaigns for consumer-brand clients.",
  whyNow:
    "Agency localization usage is repeating while collaboration friction and pricing uncertainty are appearing across the demo evidence.",
  supportingEvidence:
    "Repeat multilingual project usage; recurring requests for collaborative review; customer interest in predictable campaign pricing.",
  contradictingEvidence:
    "Some agencies complete smaller projects without collaboration features, and price sensitivity varies by campaign volume.",
  keyUnknowns:
    "Willingness to commit annually, the minimum useful reviewer workflow, and conversion lift at different agency sizes.",
  recommendedGtmMotion:
    "Offer a controlled annual-package pilot to qualified media agencies already running multilingual campaigns.",
  hypothesis:
    "If we offer media agencies already in pilot a bundle with collaborative review capabilities and predictable pricing, then pilot-to-annual-contract conversion will increase.",
  primaryMetric: "Pilot-to-annual-contract conversion rate.",
  expectedOutcome:
    "Higher pilot-to-annual-contract conversion than the current baseline.",
};

const INITIAL_VALUES: FormValues = {
  pilot_size: "500",
  current_conversion_rate: "0.02",
  expected_conversion_rate: "0.04",
  revenue_per_customer: "100000",
  acquisition_cost: "100000",
  pilot_cost: "150000",
  fixed_team_cost: "50000",
  expansion_revenue_per_customer: "0",
  evidence_confidence: "4",
  feasibility: "4",
};

const EMPTY_IMPORTED_VALUES: FormValues = {
  pilot_size: "",
  current_conversion_rate: "",
  expected_conversion_rate: "",
  revenue_per_customer: "",
  acquisition_cost: "",
  pilot_cost: "",
  fixed_team_cost: "",
  expansion_revenue_per_customer: "",
  evidence_confidence: "",
  feasibility: "",
};

const EVIDENCE_OPTIONS = [
  "Very weak evidence",
  "Limited evidence",
  "Some supporting evidence",
  "Strong cross-source evidence",
  "Very strong, consistent evidence",
];

const FEASIBILITY_OPTIONS = [
  "Very difficult",
  "Difficult",
  "Manageable",
  "Easy to execute",
  "Very easy to execute",
];

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatNumber(value: number | null) {
  return value === null ? "Not available" : numberFormatter.format(value);
}

function formatRate(value: string) {
  if (!value.trim()) return "—";
  const rate = Number(value);
  return Number.isFinite(rate) ? `${numberFormatter.format(rate * 100)}%` : "—";
}

function formatBreakEvenRate(value: number | null) {
  if (value === null) return "Not available";
  const percentage = `${formatNumber(value * 100)}%`;
  return value > 1 ? `Not achievable (${percentage} required)` : percentage;
}

function decisionSummary(decision: SimulationResult["decision"]) {
  if (decision === "GO") {
    return "Run the experiment.";
  }
  if (decision === "REVIEW") {
    return "Refine or validate the assumptions before running.";
  }
  return "Do not run this experiment under the current assumptions.";
}

function decisionLabel(decision: SimulationResult["decision"]) {
  return decision === "REVIEW" ? "REFINE" : decision;
}

function baselineContext(type: BaselineType) {
  if (type === "observed") {
    return "Based on observed historical conversion data.";
  }
  if (type === "working") {
    return "No reliable baseline was established in the available evidence. This value is being used only for modelling.";
  }
  return "The baseline is unknown. The numeric value remains an operator assumption used only for modelling.";
}

function expectedOutcomeContext(type: AssumptionType) {
  if (type === "observed") {
    return "The expected rate is supported by an existing benchmark or observed evidence.";
  }
  if (type === "working") {
    return "The expected rate is an editable modelling assumption, not a system forecast.";
  }
  return "The expected outcome is not established and must be set by the operator.";
}

function validateExperimentInputs(values: FormValues, rationale: string) {
  const required: [keyof FormValues, string][] = [
    ["current_conversion_rate", "Enter a baseline conversion rate before evaluating."],
    ["expected_conversion_rate", "Enter an expected conversion rate before evaluating."],
    ["pilot_size", "Enter a pilot size before evaluating."],
    ["evidence_confidence", "Select evidence confidence before evaluating."],
    ["feasibility", "Select execution feasibility before evaluating."],
    ["revenue_per_customer", "Enter revenue per customer before evaluating."],
    ["acquisition_cost", "Enter acquisition cost before evaluating."],
    ["pilot_cost", "Enter pilot cost before evaluating."],
    ["fixed_team_cost", "Enter fixed team cost before evaluating."],
  ];
  for (const [field, message] of required) {
    if (!values[field].trim()) return message;
  }
  if (!rationale.trim()) return "Enter a rationale for the expected outcome before evaluating.";

  const baseline = Number(values.current_conversion_rate);
  if (!Number.isFinite(baseline) || baseline < 0 || baseline > 1) {
    return "Enter a baseline conversion rate between 0 and 1.";
  }
  const expected = Number(values.expected_conversion_rate);
  if (!Number.isFinite(expected) || expected < 0 || expected > 1) {
    return "Enter an expected conversion rate between 0 and 1.";
  }
  const pilotSize = Number(values.pilot_size);
  if (!Number.isInteger(pilotSize) || pilotSize < 1) {
    return "Enter a pilot size as a positive whole number.";
  }
  for (const [field, label] of [
    ["evidence_confidence", "Evidence confidence"],
    ["feasibility", "Execution feasibility"],
  ] as [keyof FormValues, string][]) {
    const rating = Number(values[field]);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return `${label} must be between 1 and 5.`;
    }
  }
  for (const [field, label] of [
    ["revenue_per_customer", "Revenue per customer"],
    ["acquisition_cost", "Acquisition cost"],
    ["pilot_cost", "Pilot cost"],
    ["fixed_team_cost", "Fixed team cost"],
    ["expansion_revenue_per_customer", "Expansion revenue per customer"],
  ] as [keyof FormValues, string][]) {
    if (!values[field].trim() && field === "expansion_revenue_per_customer") continue;
    const amount = Number(values[field]);
    if (!Number.isFinite(amount) || amount < 0) return `${label} cannot be negative.`;
  }
  return null;
}

function primaryRisk(result: SimulationResult, baselineType: BaselineType) {
  if (baselineType === "working") {
    return "The baseline conversion is a working assumption rather than observed historical data.";
  }
  if (baselineType === "unknown") {
    return "The baseline conversion is unknown and is being modelled as an operator assumption.";
  }
  return result.risks[0];
}

function nextStep(decision: SimulationResult["decision"], baselineType: BaselineType) {
  if (baselineType !== "observed") {
    return "Validate the baseline with historical conversion data.";
  }
  if (decision === "GO") return "Run the experiment with the defined pilot.";
  if (decision === "REVIEW") return "Refine the weakest assumption, then evaluate again.";
  return "Revise the economics or experiment design before proceeding.";
}

function compactPreview(value: string, maximumLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumLength) {
    return { text: normalized, isShortened: false };
  }

  const sentenceEnd = normalized.slice(0, maximumLength).search(/[.!?](?:\s|$)/);
  if (sentenceEnd >= 60) {
    return {
      text: normalized.slice(0, sentenceEnd + 1),
      isShortened: true,
    };
  }

  const lastSpace = normalized.lastIndexOf(" ", maximumLength);
  return {
    text: `${normalized.slice(0, lastSpace > 80 ? lastSpace : maximumLength)}…`,
    isShortened: true,
  };
}

function listItems(value: string) {
  const items = value
    .split(/\n+|;\s+/)
    .map((item) => item.replace(/^\s*[-*\u2022\d.)]+\s*/, "").trim())
    .filter(Boolean);

  return items.length ? items : [value.trim()].filter(Boolean);
}

export default function Home() {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [rationale, setRationale] = useState(
    "Product usage and customer calls show recurring agency localization work, collaboration friction, and demand for predictable pricing.",
  );
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [simulatedPilotSize, setSimulatedPilotSize] = useState<number | null>(null);
  const [baselineType, setBaselineType] = useState<BaselineType>("working");
  const [expectedOutcomeType, setExpectedOutcomeType] = useState<AssumptionType>("working");
  const [simulatedBaselineType, setSimulatedBaselineType] = useState<BaselineType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<OpportunityContext>(EXPERIMENT_CONTEXT);
  const [isImported, setIsImported] = useState(false);
  const [hasStructuredRecommendation, setHasStructuredRecommendation] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isEditingContext, setIsEditingContext] = useState(false);
  const [opportunityText, setOpportunityText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  function invalidateSimulation() {
    setResult(null);
    setSimulatedPilotSize(null);
    setSimulatedBaselineType(null);
    setError(null);
  }

  function updateValue(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    invalidateSimulation();
  }

  function loadOpportunity() {
    const parsed = parseGtmOpportunity(opportunityText);
    if (!parsed.ok) {
      setImportError(opportunityParseErrorMessage(parsed));
      return;
    }

    setContext(parsed.context);
    if (parsed.recommendation) {
      const recommendation = parsed.recommendation;
      setValues({
        pilot_size: String(recommendation.pilotSize),
        current_conversion_rate: String(recommendation.baselineConversion),
        expected_conversion_rate: String(recommendation.expectedConversion),
        revenue_per_customer: String(recommendation.revenuePerCustomer),
        acquisition_cost: String(recommendation.acquisitionCost),
        pilot_cost: String(recommendation.pilotCost),
        fixed_team_cost: String(recommendation.fixedTeamCost),
        expansion_revenue_per_customer: "",
        evidence_confidence: String(recommendation.evidenceConfidence),
        feasibility: String(recommendation.executionFeasibility),
      });
      setBaselineType(recommendation.baselineType);
      setExpectedOutcomeType(recommendation.expectedOutcomeType);
      setRationale(recommendation.rationale);
      setHasStructuredRecommendation(true);
    } else {
      setValues(EMPTY_IMPORTED_VALUES);
      setBaselineType("unknown");
      setExpectedOutcomeType("unknown");
      setRationale("");
      setHasStructuredRecommendation(false);
    }
    setIsImported(true);
    setIsImporterOpen(false);
    setIsEditingContext(false);
    setImportError(null);
    setOpportunityText("");
    invalidateSimulation();
    window.setTimeout(() => {
      document.getElementById("experiment-title")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }

  function clearOpportunity() {
    setContext(EXPERIMENT_CONTEXT);
    setIsImported(false);
    setHasStructuredRecommendation(false);
    setIsEditingContext(false);
    setImportError(null);
    setOpportunityText("");
    setRationale("");
    invalidateSimulation();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateExperimentInputs(values, rationale);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError(null);

    const payload = {
      qualified_accounts: Number(values.pilot_size),
      current_conversion_rate: Number(values.current_conversion_rate),
      expected_conversion_rate: Number(values.expected_conversion_rate),
      revenue_per_customer: Number(values.revenue_per_customer),
      acquisition_cost: Number(values.acquisition_cost),
      pilot_cost: Number(values.pilot_cost),
      fixed_team_cost: Number(values.fixed_team_cost),
      expansion_revenue_per_customer: Number(
        values.expansion_revenue_per_customer || 0,
      ),
      evidence_confidence: Number(values.evidence_confidence),
      feasibility: Number(values.feasibility),
    };

    try {
      const response = await fetch("/backend-api/experiments/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("The simulation request was not accepted.");
      }

      setResult(await response.json());
      setSimulatedPilotSize(payload.qualified_accounts);
      setSimulatedBaselineType(baselineType);
    } catch {
      setError(
        "The experiment could not be simulated. Check the assumptions and confirm the backend is running.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div className="brand-lockup">
          <span className="lab-mark" aria-hidden="true">⌬</span>
          <div>
            <p className="eyebrow">Sarvam Studio · GTM Intelligence</p>
            <h1>Experiment Lab</h1>
            <p className="header-subtitle">Turn a GTM opportunity into a clear decision.</p>
          </div>
        </div>
        <div className="header-decision">
          <span>Current decision</span>
          <strong className={`header-status header-status-${result?.decision.toLowerCase() || "ready"}`}>
            {result ? decisionLabel(result.decision) : "READY"}
          </strong>
          <p>{result ? decisionSummary(result.decision) : "Set the assumptions, then evaluate the experiment."}</p>
        </div>
        <button
          type="button"
          className="secondary-button edit-experiment-button"
          onClick={() => {
            document.getElementById("experiment-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
            window.setTimeout(() => document.getElementById("current_conversion_rate")?.focus(), 350);
          }}
        >
          Edit experiment
        </button>
      </header>

      <section className="handoff-panel" aria-labelledby="handoff-title">
        <div className="handoff-copy">
          <p className="eyebrow">Manual agent handoff</p>
          <h2 id="handoff-title">Start with a GTM decision brief</h2>
          <p>
            Paste the output from your GTM Intelligence Agent. We&apos;ll turn the
            strongest opportunity into an experiment.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setIsImporterOpen((current) => !current);
            setImportError(null);
          }}
          aria-expanded={isImporterOpen}
          aria-controls="opportunity-importer"
        >
          {isImporterOpen
            ? "Close importer"
            : isImported
              ? "Replace imported opportunity"
              : "Start with a GTM decision brief"}
        </button>
        {isImported && !isImporterOpen && (
          <p className="import-confirmation" role="status">
            {hasStructuredRecommendation
              ? "Opportunity and editable assumptions imported from GTM Intelligence Agent"
              : "Opportunity imported from GTM Intelligence Agent"}
          </p>
        )}
        {isImporterOpen && (
          <div className="importer" id="opportunity-importer">
            <div className="importer-heading">
              <h3>Import GTM Intelligence Agent handoff</h3>
              <p>Paste the structured experiment recommendation JSON to prefill editable assumptions. Legacy Markdown briefs remain supported for context-only imports.</p>
            </div>
            <label htmlFor="gtm-opportunity-text">
              <span>Paste structured experiment recommendation</span>
            </label>
            <textarea
              id="gtm-opportunity-text"
              rows={14}
              value={opportunityText}
              onChange={(event) => {
                setOpportunityText(event.target.value);
                setImportError(null);
              }}
              placeholder={'{\n  "opportunity": "...",\n  "target_segment": "...",\n  "hypothesis": "...",\n  "primary_metric": "...",\n  "baseline_conversion": 0.02,\n  "baseline_type": "Working assumption",\n  "expected_conversion": 0.04,\n  "expected_outcome_type": "Working assumption",\n  "rationale": "...",\n  "pilot_size": 500,\n  "evidence_confidence": 4,\n  "execution_feasibility": 4,\n  "revenue_per_customer": 100000,\n  "acquisition_cost": 100000,\n  "pilot_cost": 150000,\n  "fixed_team_cost": 50000,\n  "key_evidence": { "product": "...", "customer": "...", "market": "..." },\n  "key_unknowns": ["..."],\n  "key_risks": ["..."]\n}'}
            />
            {importError && (
              <p className="import-error" role="alert">
                {importError}
              </p>
            )}
            <div className="import-actions">
              <button type="button" onClick={loadOpportunity}>
                Import opportunity
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setIsImporterOpen(false);
                  setImportError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <form className="workspace" onSubmit={handleSubmit} noValidate>
        <EvidenceCard
          context={context}
          confidence={Number(values.evidence_confidence)}
          isImported={isImported}
        />

        <OpportunityCard
          context={context}
          isImported={isImported}
          isEditing={isEditingContext}
          onEdit={() => setIsEditingContext(true)}
          onDoneEditing={() => setIsEditingContext(false)}
          onClear={clearOpportunity}
          onChange={(field, value) => {
            setContext((current) => ({ ...current, [field]: value }));
            invalidateSimulation();
          }}
        />

        <section className="workspace-card experiment-card" aria-labelledby="experiment-title">
          <WorkspaceHeading
            step="03"
            cue="EXPERIMENT"
            title="Experiment"
            purpose="What are we testing?"
            titleId="experiment-title"
          />
          <div className="experiment-flow" aria-label="Baseline to expected conversion">
            <div className="conversion-node">
              <p>Baseline</p>
              <strong>{formatRate(values.current_conversion_rate)}</strong>
              <span>conversion</span>
            </div>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <div className="test-node">
              <span>Test</span>
              <strong aria-hidden="true">⌬</strong>
            </div>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <div className="conversion-node expected-node">
              <p>Expected</p>
              <strong>{formatRate(values.expected_conversion_rate)}</strong>
              <span>conversion</span>
            </div>
          </div>
          <div className="primary-metric">
            <p className="context-label">Primary metric</p>
            <strong>{context.primaryMetric || "Primary metric not specified"}</strong>
          </div>
          {hasStructuredRecommendation && (
            <p className="assumption-provenance">
              Working assumptions imported from the Agent — operator editable.
            </p>
          )}

          <div className="experiment-groups">
            <section className="experiment-group test-assumptions" aria-labelledby="test-assumptions-title">
              <div className="experiment-group-heading">
                <p id="test-assumptions-title">Test assumptions</p>
                <span>Set the baseline, hypothesized outcome, and scope.</span>
              </div>
              <div className="test-assumption-grid">
                <div className="assumption-input">
                <NumberField
                  id="current_conversion_rate"
                  label="Starting point"
                  inputLabel="Baseline conversion"
                  helper="What conversion rate are we starting from?"
                  value={values.current_conversion_rate}
                  min="0"
                  max="1"
                  onChange={(value) => updateValue("current_conversion_rate", value)}
                />
                {isImported && !values.current_conversion_rate && (
                  <p className="assumption-required">
                    Baseline not established — operator assumption required.
                  </p>
                )}
                <BaselineTypeSelector
                  value={baselineType}
                  onChange={(value) => {
                    setBaselineType(value);
                    invalidateSimulation();
                  }}
                />
                </div>
                <div className="assumption-input">
                  <NumberField
                    id="expected_conversion_rate"
                    label="Hypothesized outcome"
                    inputLabel="Expected conversion rate"
                    helper="Your experiment hypothesis — not a prediction generated by the system."
                    value={values.expected_conversion_rate}
                    min="0"
                    max="1"
                    onChange={(value) => updateValue("expected_conversion_rate", value)}
                  />
                  {isImported && !values.expected_conversion_rate && (
                    <p className="assumption-required">
                      Expected outcome not established — operator assumption required.
                    </p>
                  )}
                </div>
                <div className="assumption-input">
                  <ExpectedOutcomeTypeSelector
                    value={expectedOutcomeType}
                    onChange={(value) => {
                      setExpectedOutcomeType(value);
                      invalidateSimulation();
                    }}
                  />
                </div>
                <div className="assumption-input">
                  <NumberField
                    id="pilot_size"
                    label="Test scope"
                    inputLabel="Pilot size"
                    helper="How many qualified accounts do you plan to include in this experiment?"
                    value={values.pilot_size}
                    min="1"
                    step="1"
                    onChange={(value) => updateValue("pilot_size", value)}
                  />
                </div>
              </div>
            </section>

            <section className="experiment-group confidence-group" aria-labelledby="confidence-title">
              <div className="experiment-group-heading">
                <p id="confidence-title">Confidence</p>
                <span>Operator judgments, not system-generated scores.</span>
              </div>
              <div className="judgment-grid">
                <RatingSelector
                  id="evidence_confidence"
                  label="Evidence confidence"
                  helper="How strong and consistent is the imported evidence?"
                  options={EVIDENCE_OPTIONS}
                  value={values.evidence_confidence}
                  onChange={(value) => updateValue("evidence_confidence", value)}
                />
                <RatingSelector
                  id="feasibility"
                  label="Execution feasibility"
                  helper="How realistic is the test with available resources, access, and time?"
                  options={FEASIBILITY_OPTIONS}
                  value={values.feasibility}
                  onChange={(value) => updateValue("feasibility", value)}
                />
              </div>
              <p className="evidence-note">Confidence and feasibility are operator judgments.</p>
            </section>

            <section className="experiment-group rationale-group" aria-labelledby="rationale-title">
              <div className="experiment-group-heading">
                <p id="rationale-title">Rationale</p>
                <span>Why the hypothesized outcome may be achievable.</span>
              </div>
              <details className="rationale-disclosure">
                <summary>
                  <span>{compactPreview(rationale || "No rationale added yet.", 135).text}</span>
                  <strong>View rationale</strong>
                </summary>
                <label className="rationale-field" htmlFor="experiment-rationale">
                  <span>Why do we believe this?</span>
                  <textarea
                    id="experiment-rationale"
                    value={rationale}
                    onChange={(event) => {
                      setRationale(event.target.value);
                      invalidateSimulation();
                    }}
                    rows={4}
                    placeholder="Summarize the evidence or benchmark behind your expectation."
                  />
                  <small>Why do you believe this outcome is achievable?</small>
                </label>
              </details>
            </section>
          </div>

            <button type="submit" className="evaluate-button" disabled={isLoading}>
              {isLoading ? "Evaluating experiment…" : "Evaluate Experiment"}
            </button>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
        </section>

        <EconomicsCard
          values={values}
          updateValue={updateValue}
          result={result}
          isLoading={isLoading}
          hasStructuredRecommendation={hasStructuredRecommendation}
        />

        <section className="workspace-card decision-card" aria-labelledby="decision-title">
          <WorkspaceHeading
            step="05"
            cue="DECISION"
            title="Decision"
            purpose="Should we run this experiment?"
            titleId="decision-title"
          />
          <div className="results-content" aria-live="polite">
            {!result && !isLoading && (
              <div className="empty-state">
                <span>Ready to evaluate</span>
                <p>Evaluate your assumptions to see GO, REFINE, or NO-GO.</p>
              </div>
            )}
            {isLoading && (
              <div className="empty-state loading-state">
                <span>Evaluating</span>
                <p>Comparing expected lift with incremental cost and break-even.</p>
              </div>
            )}
            {result && !isLoading && simulatedPilotSize !== null && simulatedBaselineType !== null && (
              <DecisionResult
                result={result}
                pilotSize={simulatedPilotSize}
                baselineType={simulatedBaselineType}
              />
            )}
          </div>
        </section>
      </form>
      <footer className="workspace-footer">
        <p><span aria-hidden="true">◌</span><strong>Remember:</strong> This is an experiment decision, not a product launch or rollout decision.</p>
      </footer>
    </main>
  );
}

function WorkspaceHeading({ step, cue, title, purpose, titleId }: { step: string; cue: string; title: string; purpose: string; titleId: string }) {
  return (
    <header className="workspace-heading">
      <div className="workspace-step"><span>{step}</span><strong>{cue}</strong></div>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p>{purpose}</p>
      </div>
    </header>
  );
}

function OpportunityCard({
  context,
  isImported,
  isEditing,
  onEdit,
  onDoneEditing,
  onClear,
  onChange,
}: {
  context: OpportunityContext;
  isImported: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onDoneEditing: () => void;
  onClear: () => void;
  onChange: (
    field: "opportunity" | "targetSegment" | "hypothesis" | "expectedOutcome" | "primaryMetric",
    value: string,
  ) => void;
}) {
  return (
    <section className="workspace-card opportunity-card" aria-labelledby="opportunity-title">
      <div className="opportunity-heading">
        <WorkspaceHeading step="02" cue="OPPORTUNITY" title="Opportunity" purpose="What are we trying to exploit?" titleId="opportunity-title" />
        <div className="context-actions">
          <span className={isImported ? "agent-badge" : "demo-badge"}>
            {isImported
              ? "Imported from GTM Intelligence Agent"
              : "Synthetic / demo data"}
          </span>
          {isImported && !isEditing && (
            <>
              <button type="button" className="text-button" onClick={onEdit}>
                Edit context
              </button>
              <button type="button" className="text-button danger-text" onClick={onClear}>
                Clear opportunity
              </button>
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <div className="context-edit-grid">
          <ContextEditField label="Opportunity" value={context.opportunity} onChange={(value) => onChange("opportunity", value)} wide />
          <ContextEditField label="Target segment" value={context.targetSegment} onChange={(value) => onChange("targetSegment", value)} />
          <ContextEditField label="Primary metric" value={context.primaryMetric} onChange={(value) => onChange("primaryMetric", value)} />
          <ContextEditField label="Hypothesis" value={context.hypothesis} onChange={(value) => onChange("hypothesis", value)} wide />
          <ContextEditField label="Expected outcome" value={context.expectedOutcome} onChange={(value) => onChange("expectedOutcome", value)} wide />
          <button type="button" className="secondary-button done-editing" onClick={onDoneEditing}>Done editing</button>
        </div>
      ) : (
        <div className="opportunity-content">
          <BriefItem label="Opportunity" value={context.opportunity} emphasis />
          <div className="opportunity-secondary">
            <BriefItem label="Target segment" value={context.targetSegment} />
            <BriefItem label="Hypothesis · IF / FOR / THEN / BECAUSE" value={context.hypothesis} />
          </div>
          <details className="full-context opportunity-context">
            <summary>View context</summary>
            {context.whyNow && <p><strong>Why this matters now</strong><br />{context.whyNow}</p>}
            {context.expectedOutcome && <p><strong>Expected outcome</strong><br />{context.expectedOutcome}</p>}
          </details>
        </div>
      )}
    </section>
  );
}

function EvidenceCard({
  context,
  confidence,
  isImported,
}: {
  context: OpportunityContext;
  confidence: number;
  isImported: boolean;
}) {
  const sourceEvidence = sourceEvidenceForDisplay(context.supportingEvidence);
  const hasConfidence = confidence >= 1 && confidence <= 5;
  const sourcePreviews = [
    sourceEvidence.product,
    sourceEvidence.customer,
    sourceEvidence.market,
  ].map(conciseEvidencePreview);
  const sourceDetails = [sourceEvidence.product, sourceEvidence.customer, sourceEvidence.market];
  const unknowns = listItems(context.keyUnknowns);

  return (
      <section className="workspace-card evidence-card" aria-labelledby="evidence-title">
        <WorkspaceHeading step="01" cue="SIGNAL" title="Signal" purpose="Why do we believe this opportunity exists?" titleId="evidence-title" />
        <div className="evidence-title-row">
          <h3 className="card-title">Evidence at a glance</h3>
          {isImported && (
            <span className="agent-badge">Imported from GTM Intelligence Agent</span>
          )}
        </div>
        <div className="source-blocks">
          {(["Product", "Customer", "Market"] as const).map((source, index) => (
            <article className="source-block" key={source}>
              <span className={`source-icon source-icon-${source.toLowerCase()}`} aria-hidden="true">
                {source === "Product" ? "◇" : source === "Customer" ? "◎" : "↗"}
              </span>
              <div>
                <p>{source}</p>
                <strong className="source-summary">{sourcePreviews[index].headline}</strong>
                {sourcePreviews[index].detail && (
                  <span className="source-detail">{sourcePreviews[index].detail}</span>
                )}
                {hasConfidence && (
                  <span className="strength-dots" aria-label={`Operator evidence confidence ${confidence} out of 5`}>
                    {[1, 2, 3, 4, 5].map((dot) => <i className={dot <= confidence ? "active" : ""} key={dot} />)}
                  </span>
                )}
                <details className="source-evidence-disclosure">
                  <summary>View evidence</summary>
                  <div>{sourceDetails[index]}</div>
                </details>
              </div>
            </article>
          ))}
        </div>
        <div className="signal-strength">
          <span>Operator judgment</span>
          <small>
            {hasConfidence
              ? `Evidence confidence ${confidence}/5`
              : "Evidence confidence not set"}
          </small>
        </div>
        <details className="full-evidence">
          <summary>
            <strong>View supporting context</strong>
            <span className="disclosure-action">→</span>
          </summary>
          <div className="full-evidence-content">
            {context.whyNow && <EvidenceDetail label="Why now" value={context.whyNow} />}
            {context.contradictingEvidence && <EvidenceDetail label="Contradicting evidence" value={context.contradictingEvidence} />}
            {context.recommendedGtmMotion && <EvidenceDetail label="Recommended GTM motion" value={context.recommendedGtmMotion} />}
          </div>
        </details>
        {context.keyUnknowns && (
          <details className="key-unknowns">
            <summary>{unknowns.length} key {unknowns.length === 1 ? "unknown" : "unknowns"}</summary>
            <ul>{unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul>
            <small>Uncertainties for the operator to consider when setting assumptions.</small>
          </details>
        )}
      </section>
  );
}

function BriefItem({ label, value, emphasis = false, quote = false }: { label: string; value: string; emphasis?: boolean; quote?: boolean }) {
  const preview = compactPreview(value, emphasis ? 180 : 240);
  const expansionLabel = label.startsWith("Hypothesis")
    ? "View full hypothesis"
    : `Read full ${label.toLowerCase()}`;
  return (
    <article className={`brief-item${emphasis ? " brief-emphasis" : ""}${quote ? " brief-quote" : ""}`}>
      <p className="context-label">{label}</p>
      <strong>{quote ? `“${preview.text}”` : preview.text}</strong>
      {preview.isShortened && (
        <details className="full-context">
          <summary>{expansionLabel}</summary>
          <p>{value}</p>
        </details>
      )}
    </article>
  );
}

function EvidenceDetail({ label, value }: { label: string; value: string }) {
  return (
    <article className="evidence-detail">
      <p className="context-label">{label}</p>
      <div>{value}</div>
    </article>
  );
}

function ContextEditField({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <label className={`context-edit-field${wide ? " context-item-wide" : ""}`}>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} required />
    </label>
  );
}

function NumberField({
  id,
  label,
  inputLabel,
  helper,
  value,
  min,
  max,
  step = "any",
  onChange,
}: {
  id: string;
  label: string;
  inputLabel: string;
  helper: string;
  value: string;
  min: string;
  max?: string;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="question-row">
      <div>
        <p className="question-label">{label}</p>
        <label htmlFor={id}>{inputLabel}</label>
        <small>{helper}</small>
      </div>
      <input
        id={id}
        name={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

function RatingSelector({
  id,
  label,
  helper,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  helper: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rating-field" htmlFor={id}>
      <span>{label}</span>
      <small>{helper}</small>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>Select judgment</option>
        {options.map((option, index) => (
          <option key={option} value={index + 1}>
            {index + 1} — {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function BaselineTypeSelector({ value, onChange }: { value: BaselineType; onChange: (value: BaselineType) => void }) {
  return (
    <label className="baseline-type-field" htmlFor="baseline_type">
      <div>
        <span>Baseline type</span>
        <small>{baselineContext(value)}</small>
      </div>
      <select
        id="baseline_type"
        value={value}
        onChange={(event) => onChange(event.target.value as BaselineType)}
      >
        <option value="observed">Observed baseline</option>
        <option value="working">Working assumption</option>
        <option value="unknown">Unknown</option>
      </select>
    </label>
  );
}

function ExpectedOutcomeTypeSelector({
  value,
  onChange,
}: {
  value: AssumptionType;
  onChange: (value: AssumptionType) => void;
}) {
  return (
    <label className="baseline-type-field" htmlFor="expected_outcome_type">
      <div>
        <span>Expected outcome type</span>
        <small>{expectedOutcomeContext(value)}</small>
      </div>
      <select
        id="expected_outcome_type"
        value={value}
        onChange={(event) => onChange(event.target.value as AssumptionType)}
      >
        <option value="observed">Evidence-backed estimate</option>
        <option value="working">Working assumption</option>
        <option value="unknown">Unknown</option>
      </select>
    </label>
  );
}

function EconomicsCard({
  values,
  updateValue,
  result,
  isLoading,
  hasStructuredRecommendation,
}: {
  values: FormValues;
  updateValue: (key: keyof FormValues, value: string) => void;
  result: SimulationResult | null;
  isLoading: boolean;
  hasStructuredRecommendation: boolean;
}) {
  return (
    <section className="workspace-card economics-card" aria-labelledby="economics-title">
      <WorkspaceHeading
        step="04"
        cue="IMPACT"
        title="Impact"
        purpose="If the hypothesis is right, what is the economic impact?"
        titleId="economics-title"
      />

      {result && !isLoading ? (
        <div className="impact-flow">
          <ImpactNode symbol="♙" value={formatNumber(result.incremental_customers)} label="Incremental customers" />
          <span className="impact-arrow" aria-hidden="true">→</span>
          <ImpactNode symbol="₹" value={currencyFormatter.format(result.incremental_revenue)} label="Incremental revenue" />
          <span className="impact-arrow" aria-hidden="true">→</span>
          <ImpactNode symbol="−" value={currencyFormatter.format(result.total_incremental_cost)} label="Incremental cost" tone="cost" />
          <span className="impact-arrow" aria-hidden="true">→</span>
          <ImpactNode
            symbol="↗"
            value={result.incremental_roi === null ? "Not available" : `${formatNumber(result.incremental_roi)}%`}
            label="Incremental ROI"
            tone="return"
          />
        </div>
      ) : (
        <p className="economics-pending">
          {isLoading ? "Calculating incremental economics…" : "Review the assumptions, then evaluate the experiment."}
        </p>
      )}

      <p className="working-assumptions-label">Based on current working assumptions</p>

      <details className="disclosure economics-disclosure">
        <summary>
          <strong>View financial assumptions</strong>
          <span className="disclosure-action">→</span>
        </summary>
        <div className="economics-details">
          <FinancialAssumptions
            values={values}
            updateValue={updateValue}
            hasStructuredRecommendation={hasStructuredRecommendation}
          />
          {result && !isLoading && (
            <div className="break-even-grid">
              <ResultCard label="Break-even customers" value={formatNumber(result.break_even_incremental_customers)} />
              <ResultCard
                label="Break-even conversion"
                value={formatBreakEvenRate(result.break_even_expected_conversion_rate)}
              />
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function ImpactNode({ symbol, value, label, tone = "default" }: { symbol: string; value: string; label: string; tone?: "default" | "cost" | "return" }) {
  return (
    <article className={`impact-node impact-node-${tone}`}>
      <span className="impact-icon" aria-hidden="true">{symbol}</span>
      <strong>{value}</strong>
      <p>{label}</p>
    </article>
  );
}

function FinancialAssumptions({
  values,
  updateValue,
  hasStructuredRecommendation,
}: {
  values: FormValues;
  updateValue: (key: keyof FormValues, value: string) => void;
  hasStructuredRecommendation: boolean;
}) {
  return (
    <div className="financial-assumptions">
      <div className="financial-heading">
        <strong>Financial assumptions</strong>
        <span>Inputs used by the existing economics model</span>
        {hasStructuredRecommendation && (
          <small>Working assumptions imported from the Agent — operator editable.</small>
        )}
      </div>
      <div className="financial-grid">
        <CompactField
          id="revenue_per_customer"
          label="Revenue per customer"
          helper="Expected revenue from one new paid customer."
          value={values.revenue_per_customer}
          onChange={(value) => updateValue("revenue_per_customer", value)}
        />
        <CompactField
          id="acquisition_cost"
          label="Acquisition cost"
          helper="Expected cost to acquire one new paid customer."
          value={values.acquisition_cost}
          onChange={(value) => updateValue("acquisition_cost", value)}
        />
        <CompactField
          id="pilot_cost"
          label="Pilot cost"
          helper="Direct cost of running this experiment."
          value={values.pilot_cost}
          onChange={(value) => updateValue("pilot_cost", value)}
        />
        <CompactField
          id="fixed_team_cost"
          label="Fixed team cost"
          helper="Internal team cost allocated to this experiment."
          value={values.fixed_team_cost}
          onChange={(value) => updateValue("fixed_team_cost", value)}
        />
      </div>
      <details className="disclosure advanced-disclosure">
        <summary>
          <strong>Advanced assumptions</strong>
          <span className="disclosure-action">Optional</span>
        </summary>
        <CompactField
          id="expansion_revenue_per_customer"
          label="Expansion revenue per customer"
          helper="Optional additional consumption or expansion revenue from each incremental customer."
          value={values.expansion_revenue_per_customer}
          onChange={(value) => updateValue("expansion_revenue_per_customer", value)}
          required={false}
        />
      </details>
    </div>
  );
}

function CompactField({
  id,
  label,
  helper,
  value,
  onChange,
  required = true,
}: {
  id: string;
  label: string;
  helper: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="compact-field" htmlFor={id}>
      <span>{label}</span>
      <small>{helper}</small>
      <input
        id={id}
        name={id}
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function DecisionResult({ result, pilotSize, baselineType }: { result: SimulationResult; pilotSize: number; baselineType: BaselineType }) {
  return (
    <div className="result-stack">
      <article className={`decision-hero decision-${result.decision.toLowerCase()}`}>
        <div className="decision-topline">
          <div>
            <p>Decision</p>
            <strong>{decisionLabel(result.decision)}</strong>
          </div>
        </div>
        <p className="decision-summary">{decisionSummary(result.decision)}</p>
      </article>

      <div className="decision-signals">
        <div>
          <p>Key reason</p>
          <span>{result.reasons[0]}</span>
        </div>
        <div>
          <p>Main risk</p>
          <span>{primaryRisk(result, baselineType)}</span>
        </div>
        <div>
          <p>Next step</p>
          <span>{nextStep(result.decision, baselineType)}</span>
        </div>
      </div>

      <div className="pilot-ownership">
        <span>Pilot (operator-owned)</span>
        <strong>Pilot: {formatNumber(pilotSize)} {pilotSize === 1 ? "account" : "accounts"}</strong>
      </div>

      <details className="disclosure reasoning-disclosure">
        <summary>
          <strong>See detailed reasoning &amp; assumptions</strong>
          <span className="disclosure-action">⌄</span>
        </summary>
        <div className="reasoning-content">
          <section>
            <h3>Decision reasons</h3>
            <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </section>
          <section>
            <h3>Risks</h3>
            <ul>{result.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
          </section>
        </div>
      </details>
    </div>
  );
}

function ResultCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <article className={`result-card${emphasis ? " result-card-emphasis" : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
