import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const nextConfigSource = await readFile(
  new URL("../next.config.mjs", import.meta.url),
  "utf8",
);
const agentHandoffSource = await readFile(
  new URL("../../knowledge/work-agent-decision-brief.md", import.meta.url),
  "utf8",
);

test("renders the five GTM workspace stages in order", () => {
  const stages = [
    "<EvidenceCard",
    "<OpportunityCard",
    'title="Experiment"',
    "<EconomicsCard",
    'title="Decision"',
  ];

  let previousIndex = -1;
  for (const stage of stages) {
    const index = pageSource.indexOf(stage);
    assert.ok(index > previousIndex, `${stage} should follow the previous stage`);
    previousIndex = index;
  }
});

test("keeps source evidence and detail disclosures available", () => {
  assert.match(pageSource, /\["Product", "Customer", "Market"\]/);
  assert.match(pageSource, /<strong>View full evidence<\/strong>/);
  assert.match(pageSource, /<strong>View full economics<\/strong>/);
  assert.match(pageSource, /See detailed reasoning &amp; assumptions/);
  assert.match(pageSource, /Recommended GTM motion/);
  assert.match(pageSource, /sourceEvidenceForDisplay\(context\.supportingEvidence\)/);
  assert.match(pageSource, /\.map\(conciseEvidencePreview\)/);
  assert.match(pageSource, /className="source-summary"/);
  assert.match(pageSource, /className="source-detail"/);
  assert.match(pageSource, /context\.primaryMetric \|\| "Primary metric not specified"/);
  assert.match(pageSource, /Imported from GTM Intelligence Agent/);
  assert.match(pageSource, /className="key-unknowns"/);
  assert.match(pageSource, /Uncertainties for the operator to consider when setting assumptions\./);
  assert.match(pageSource, /<p className="context-label">Experiment hypothesis<\/p>/);
});

test("uses concise Experiment terminology", () => {
  assert.match(pageSource, /purpose="What are we testing\?"/);
  assert.match(pageSource, /<p>Baseline<\/p>/);
  assert.match(pageSource, /<p>Expected<\/p>/);
  assert.match(pageSource, /<span>Why do we believe this\?<\/span>/);
  assert.doesNotMatch(pageSource, /What are we betting\?|Today \(baseline\)|Hypothesis \(expected\)|Rationale for expected conversion/);
});

test("uses the reference-aligned vertical decision language", () => {
  assert.match(pageSource, /cue="SIGNAL"/);
  assert.match(pageSource, /cue="OPPORTUNITY"/);
  assert.match(pageSource, /cue="EXPERIMENT"/);
  assert.match(pageSource, /cue="IMPACT"/);
  assert.match(pageSource, /cue="DECISION"/);
  assert.match(pageSource, /Turn a GTM opportunity into a clear decision\./);
  assert.match(pageSource, /Pilot \(operator-owned\)/);
});

test("keeps the existing simulation contract unchanged", () => {
  assert.match(pageSource, /qualified_accounts:\s*Number\(values\.pilot_size\)/);
  assert.match(pageSource, /current_conversion_rate:\s*Number\(values\.current_conversion_rate\)/);
  assert.match(pageSource, /expected_conversion_rate:\s*Number\(values\.expected_conversion_rate\)/);
  assert.doesNotMatch(pageSource, /baseline_type:\s*/);
});

test("documents the structured Agent recommendation without assigning the decision", () => {
  for (const field of [
    "baseline_conversion",
    "baseline_type",
    "expected_conversion",
    "expected_outcome_type",
    "pilot_size",
    "evidence_confidence",
    "execution_feasibility",
    "revenue_per_customer",
    "acquisition_cost",
    "pilot_cost",
    "fixed_team_cost",
    "key_evidence",
    "key_unknowns",
    "key_risks",
  ]) {
    assert.match(agentHandoffSource, new RegExp(`"${field}"`));
  }
  assert.match(agentHandoffSource, /must never return GO or NO-GO/);
  assert.match(agentHandoffSource, /working assumption for experiment modelling/);
});

test("uses REFINE as the user-facing label without changing the REVIEW API value", () => {
  assert.match(pageSource, /return decision === "REVIEW" \? "REFINE" : decision/);
  assert.match(pageSource, /decisionLabel\(result\.decision\)/);
  assert.match(pageSource, /GO, REFINE, or NO-GO/);
  assert.match(pageSource, /decision: "GO" \| "REVIEW" \| "NO-GO"/);
});

test("keeps development output separate from the running production bundle", () => {
  assert.match(
    nextConfigSource,
    /distDir:\s*process\.env\.NODE_ENV === "development" \? "\.next-dev" : "\.next"/,
  );
});
