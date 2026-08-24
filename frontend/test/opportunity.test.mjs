import assert from "node:assert/strict";
import test from "node:test";

import {
  extractSourceEvidence,
  opportunityParseErrorMessage,
  parseGtmOpportunity,
  sourceEvidenceForDisplay,
} from "../app/opportunity.ts";

const sections = [
  ["Opportunity", "A multilingual agency bundle"],
  ["Target segment", "Media agencies"],
  ["Why now", "Repeat localization usage is increasing"],
  ["Supporting evidence", "Product and customer signals converge"],
  ["Contradicting evidence", "Some agencies remain price sensitive"],
  ["Key unknowns", "Annual willingness to pay"],
  ["Recommended GTM motion", "Run a controlled pilot"],
  ["Experiment hypothesis", "A bundle will improve conversion"],
  ["Expected outcome", "More annual contracts"],
  ["Primary metric", "Pilot-to-annual conversion rate"],
];

function documentWithHeading(format) {
  return sections
    .flatMap(([heading, value], index) => [format(heading, index + 1), value])
    .join("\n");
}

function assertAllSections(text) {
  const result = parseGtmOpportunity(text);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  assert.equal(Object.keys(result.context).length, 10);
  for (const value of Object.values(result.context)) assert.notEqual(value, "");
  return result.context;
}

test("parses plain section headings", () => {
  assertAllSections(documentWithHeading((heading) => heading));
});

test("parses bold section headings", () => {
  assertAllSections(documentWithHeading((heading) => `**${heading}**`));
});

test("parses Markdown section headings", () => {
  assertAllSections(documentWithHeading((heading, index) => `${"#".repeat((index % 3) + 1)} ${heading}`));
});

test("parses numbered Markdown section headings", () => {
  assertAllSections(documentWithHeading((heading, index) => `### ${index}. ${heading}`));
});

test("parses the numbered format produced by the GTM Intelligence Agent", () => {
  const actualAgentFormat = sections
    .flatMap(([heading, value], index) => [
      `### ${index + 1}. ${heading}`,
      "",
      value,
      "",
    ])
    .join("\n");

  const context = assertAllSections(actualAgentFormat);
  assert.equal(context.opportunity, "A multilingual agency bundle");
  assert.equal(context.targetSegment, "Media agencies");
  assert.equal(context.primaryMetric, "Pilot-to-annual conversion rate");
});

test("recovers a copied opportunity whose first heading alone was omitted", () => {
  const withoutFirstHeading = [
    sections[0][1],
    ...sections.slice(1).flatMap(([heading, value], index) => [
      `### ${index + 2}. ${heading}`,
      value,
    ]),
  ].join("\n");

  const context = assertAllSections(withoutFirstHeading);
  assert.equal(context.opportunity, sections[0][1]);
});

test("reports genuinely missing sections", () => {
  const result = parseGtmOpportunity("### 1. Opportunity\nA real opportunity");
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["Target segment", "Hypothesis", "Primary metric"]);
});

test("reports blank sections as missing", () => {
  const blankTarget = documentWithHeading((heading, index) => `### ${index}. ${heading}`)
    .replace("### 2. Target segment\nMedia agencies", "### 2. Target segment\n");
  const result = parseGtmOpportunity(blankTarget);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["Target segment"]);
});

test("does not assign arbitrary unnumbered preamble to a missing opportunity", () => {
  const input = [
    "General introduction that is not labelled as an opportunity.",
    ...sections.slice(1).flatMap(([heading, value]) => [heading, value]),
  ].join("\n");
  const result = parseGtmOpportunity(input);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["Opportunity"]);
});

test("parses the concise GTM decision brief aliases", () => {
  const conciseHeadings = {
    "Target segment": "Audience",
    "Supporting evidence": "Evidence highlights",
    "Contradicting evidence": "Contradictions",
    "Key unknowns": "Unknowns",
    "Recommended GTM motion": "Recommended motion",
    "Experiment hypothesis": "Hypothesis",
    "Expected outcome": "Outcome",
  };
  const conciseBrief = sections
    .flatMap(([heading, value]) => [conciseHeadings[heading] || heading, value])
    .join("\n");

  const context = assertAllSections(conciseBrief);
  assert.equal(context.hypothesis, "A bundle will improve conversion");
  assert.equal(context.supportingEvidence, "Product and customer signals converge");
});

test("removes Markdown artifacts, citation IDs, and repeated claims", () => {
  const decorated = sections
    .map(([heading, value]) => {
      if (heading === "Opportunity") {
        return `**${heading}**\n**${value}** [PS-12]`;
      }
      if (heading === "Supporting evidence") {
        return `${heading}\n- Repeat usage increased. [product:42]\n- Repeat usage increased. [product:42]\n- [Customer calls](https://example.invalid) support the need. 【customer-7】`;
      }
      return `${heading}\n${value}`;
    })
    .join("\n");

  const context = assertAllSections(decorated);
  assert.equal(context.opportunity, "A multilingual agency bundle");
  assert.equal(
    context.supportingEvidence,
    "Repeat usage increased.\nCustomer calls support the need.",
  );
  assert.doesNotMatch(Object.values(context).join(" "), /\*\*|\[PS-12\]|product:42|customer-7/);
});

test("keeps the concise Agent outcome sentence under Expected outcome", () => {
  const conciseAgentBrief = `Opportunity
A multilingual agency conversion opportunity

Audience
Media agencies

Why now
Pilot usage is increasing

Evidence highlights
Agencies are repeating multilingual projects

Contradictions
Some agencies remain price sensitive

Unknowns
Annual willingness to pay

Recommended motion
Run a controlled conversion pilot

Hypothesis
If we offer a predictable package, pilot-to-paid conversion will increase

Expected outcome
Hypothesis: agency pilot-to-paid conversion will increase compared with the current baseline.

Primary metric
Pilot-to-paid conversion rate`;

  const context = assertAllSections(conciseAgentBrief);
  assert.equal(
    context.expectedOutcome,
    "Hypothesis: agency pilot-to-paid conversion will increase compared with the current baseline.",
  );
});

const currentWorkAgentBrief = `### **Opportunity**
**Collaborative review for multilingual agency campaigns.** [cite:opp123]

### Who is this for?
- Media agencies managing multilingual client work.

### Why test this?
- Product: Repeat projects bring editors back. [cite:product456]
- Customer: Agencies ask for collaborative review and predictable pricing.
- Market: Localization workflows remain fragmented.

### What should we test?
“If we bundle collaborative review with predictable pricing, pilot-to-paid conversion will increase.”

### Primary metric
Pilot-to-paid conversion rate.

### What could make us wrong?
- Smaller agencies may not need a reviewer workflow.

### Other opportunities
- Enterprise procurement automation.
- Creator self-serve bundles.`;

test("parses the current concise Work Agent decision brief", () => {
  const result = parseGtmOpportunity(currentWorkAgentBrief);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  assert.equal(result.context.opportunity, "Collaborative review for multilingual agency campaigns.");
  assert.equal(result.context.targetSegment, "Media agencies managing multilingual client work.");
  assert.equal(result.context.hypothesis, "If we bundle collaborative review with predictable pricing, pilot-to-paid conversion will increase.");
  assert.equal(result.context.primaryMetric, "Pilot-to-paid conversion rate.");
  assert.match(result.context.supportingEvidence, /Repeat projects bring editors back/);
  assert.match(result.context.keyUnknowns, /Smaller agencies/);
});

test("removes Markdown, citations, bullets, and unnecessary quotes from concise briefs", () => {
  const result = parseGtmOpportunity(currentWorkAgentBrief);
  assert.equal(result.ok, true);
  const imported = Object.values(result.context).join(" ");
  assert.doesNotMatch(imported, /\*\*|#{1,3}|\[cite:|^[\s]*[-•]/m);
  assert.doesNotMatch(result.context.hypothesis, /^[“"]|[”"]$/);
});

test("imports only the primary opportunity and ignores Other opportunities", () => {
  const result = parseGtmOpportunity(currentWorkAgentBrief);
  assert.equal(result.ok, true);
  const imported = Object.values(result.context).join(" ");
  assert.doesNotMatch(imported, /Enterprise procurement|Creator self-serve/);
});

test("accepts a concise opportunity without optional evidence sections", () => {
  const incomplete = `Opportunity
A useful agency opportunity

Who is this for?
Media agencies

What should we test?
Hypothesis: If agencies receive predictable pricing, conversion will increase.

Primary metric: Agency pilot-to-paid conversion rate.`;
  const result = parseGtmOpportunity(incomplete);
  assert.equal(result.ok, true);
  assert.equal(result.context.supportingEvidence, "");
  assert.equal(result.context.keyUnknowns, "");
  assert.equal("current_conversion_rate" in result.context, false);
  assert.equal("expected_conversion_rate" in result.context, false);
});

test("continues to require and parse the legacy ten-section format", () => {
  const context = assertAllSections(documentWithHeading((heading, index) => `### ${index}. ${heading}`));
  assert.equal(context.expectedOutcome, "More annual contracts");
  assert.equal(context.recommendedGtmMotion, "Run a controlled pilot");
});

const fullRawAgentResponse = `Let me read the full customer and market intelligence files first.
Now let me read the product intelligence agency segment.
I reviewed all available evidence and found the strongest opportunity below.

### Opportunity

**Offer media agencies a collaborative review and approval workflow with predictable campaign pricing.** [cite:opp-main-42]

### Who is this for?

Media agencies managing multilingual localization campaigns for consumer brands.

### Why test this?

- **Product:** Repeat multilingual projects bring agency editors back into the workflow. [cite:product-17]
- **Customer:** Agencies repeatedly request collaborative review and predictable pricing. [cite:customer-28]
- **Market:** Localization delivery remains fragmented across review tools. [cite:market-09]

### What should we test?

**Hypothesis:** If we bundle collaborative approval with predictable pricing, agency pilot-to-paid conversion will increase.

**Primary metric:** Agency pilot-to-paid conversion rate.

### What could make us wrong?

- Smaller agencies may not need a reviewer workflow.
- Procurement timing may delay conversion.
- Existing tools may be sufficient for low-volume campaigns.

### Other opportunities

#### Opportunity 2
Create a self-serve creator bundle.

#### Opportunity 3
Automate enterprise procurement reviews.`;

test("extracts the primary opportunity from an entire raw Agent response", () => {
  const result = parseGtmOpportunity(fullRawAgentResponse);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  const { context } = result;
  const evidence = extractSourceEvidence(context.supportingEvidence);

  assert.equal(context.opportunity, "Offer media agencies a collaborative review and approval workflow with predictable campaign pricing.");
  assert.equal(context.targetSegment, "Media agencies managing multilingual localization campaigns for consumer brands.");
  assert.equal(evidence.product, "Repeat multilingual projects bring agency editors back into the workflow.");
  assert.equal(evidence.customer, "Agencies repeatedly request collaborative review and predictable pricing.");
  assert.equal(evidence.market, "Localization delivery remains fragmented across review tools.");
  assert.equal(context.hypothesis, "If we bundle collaborative approval with predictable pricing, agency pilot-to-paid conversion will increase.");
  assert.equal(context.primaryMetric, "Agency pilot-to-paid conversion rate.");
  assert.match(context.keyUnknowns, /Smaller agencies/);
  assert.doesNotMatch(Object.values(context).join(" "), /Let me read|I reviewed|creator bundle|enterprise procurement/);
  assert.doesNotMatch(Object.values(context).join(" "), /\*\*|#{1,4}|\[cite:/);
  assert.equal(Object.values(context).filter((value) => value.includes("Repeat multilingual projects")).length, 1);
  assert.equal("baseline" in context, false);
  assert.equal(context.expectedOutcome, "");
});

test("returns an error only when a concise response has no opportunity", () => {
  const result = parseGtmOpportunity(`Let me review the evidence.\n\n### Who is this for?\nMedia agencies\n\n### What should we test?\nRun a pricing pilot`);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["Opportunity", "Primary metric"]);
});

const exactRealWorldAgentResponse = `Let me read the full customer and market intelligence files to get the complete agency segment picture.
Now let me read the full product intelligence agency segment to confirm the product signals.

### Opportunity

Offer media agencies a collaborative review and approval workflow paired with a predictable, revision-safe localization bundle, so multilingual campaign pilots convert to annual plans.

### Who is this for?

Media agencies running multilingual advertising campaigns across regional Indian languages for multiple client brands.

### Why test this?

- **Product:** Agencies activate collaboratively — they invite editors and create client campaign projects immediately, return weekly for four consecutive weeks, produce 42 dubbing minutes across nine campaign assets, and convert to paid after a successful client pilot.
- **Customer:** Agencies repeatedly ask for client workspaces, reviewer roles, project-level access controls, and the ability for reviewers to comment on precise output moments.
- **Market:** The market data identifies shared pronunciation and tone review across regional campaign variants as an unmet workflow need.

### What should we test?

**Hypothesis:** If we give agency pilots a collaborative review package bundled with predictable pricing, then a higher share of agency pilots will convert to annual plans.

**Primary metric:** Agency pilot-to-paid conversion rate.

### What could make us wrong?

- The market sample is thin.
- Annual-plan intent is conditional on a successful client outcome.
- The datasets are synthetic demo data.

### Other opportunities

**Opportunity:** Build a governance-ready localization package...
**Target segment:** L&D, compliance...
**Why promising:** Enterprise shows...

**Opportunity:** Create a lower-volume creator plan...
**Target segment:** Individual regional-language creators...
**Why promising:** Creators show...`;

test("parses the exact real-world Agent response and ignores secondary opportunities", () => {
  const result = parseGtmOpportunity(exactRealWorldAgentResponse);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  const { context } = result;
  const evidence = extractSourceEvidence(context.supportingEvidence);

  assert.equal(
    context.opportunity,
    "Offer media agencies a collaborative review and approval workflow paired with a predictable, revision-safe localization bundle, so multilingual campaign pilots convert to annual plans.",
  );
  assert.equal(
    context.targetSegment,
    "Media agencies running multilingual advertising campaigns across regional Indian languages for multiple client brands.",
  );
  assert.match(evidence.product, /Agencies activate collaboratively/);
  assert.match(evidence.customer, /Agencies repeatedly ask for client workspaces/);
  assert.match(evidence.market, /shared pronunciation and tone review/);
  assert.equal(
    context.hypothesis,
    "If we give agency pilots a collaborative review package bundled with predictable pricing, then a higher share of agency pilots will convert to annual plans.",
  );
  assert.equal(context.primaryMetric, "Agency pilot-to-paid conversion rate.");
  assert.match(context.keyUnknowns, /market sample is thin/);
  assert.doesNotMatch(
    Object.values(context).join(" "),
    /Let me read|governance-ready|lower-volume creator|Enterprise shows|Creators show/,
  );
});

test("parses a bold-label primary opportunity after preamble", () => {
  const result = parseGtmOpportunity(`Preparing a concise recommendation from the evidence.

**Opportunity:** Build a governance-ready localization package. [cite:opp-1]
**Target segment:** L&D, compliance, and customer-education teams.
**Why promising:** Enterprise buyers repeatedly request governance controls. [cite:customer-4]
**Hypothesis:** If governance controls are bundled into the pilot, paid conversion will increase.
**Primary metric:** Enterprise pilot-to-paid conversion rate.`);

  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  assert.equal(result.context.opportunity, "Build a governance-ready localization package.");
  assert.equal(result.context.targetSegment, "L&D, compliance, and customer-education teams.");
  assert.equal(result.context.supportingEvidence, "Enterprise buyers repeatedly request governance controls.");
  assert.equal(
    result.context.hypothesis,
    "If governance controls are bundled into the pilot, paid conversion will increase.",
  );
  assert.equal(result.context.primaryMetric, "Enterprise pilot-to-paid conversion rate.");
  assert.doesNotMatch(Object.values(result.context).join(" "), /Preparing|\*\*|\[cite:/);
});

test("supports plain inline labels in a concise primary opportunity", () => {
  const result = parseGtmOpportunity(`Preamble to ignore.
Opportunity: Test a revision-safe agency bundle.
Target segment: Media agencies.
Why promising: Repeated agency requests support the test.
Hypothesis: If the bundle is predictable, conversion will increase.
Primary metric: Pilot-to-paid conversion rate.`);

  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  assert.equal(result.context.opportunity, "Test a revision-safe agency bundle.");
  assert.equal(result.context.supportingEvidence, "Repeated agency requests support the test.");
});

test("rejects completely invalid prose with no recognizable Opportunity", () => {
  const result = parseGtmOpportunity("I reviewed the available signals and found several possible directions.");
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["Opportunity", "Target segment", "Hypothesis", "Primary metric"]);
});

test("imports standalone bold labels followed by values", () => {
  const result = parseGtmOpportunity(`Based on my review, this is the strongest opportunity.

**Opportunity:**
Create a predictable localization plan for active agencies.

**Target segment:**
Media agencies with four or more weeks of active usage.

**Hypothesis:**
If active agencies receive predictable pricing, annual-plan conversion will increase.

**Primary metric:**
Agency-to-annual-plan conversion rate among agencies with four or more weeks of active usage.`);

  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  assert.equal(result.context.opportunity, "Create a predictable localization plan for active agencies.");
  assert.equal(result.context.targetSegment, "Media agencies with four or more weeks of active usage.");
  assert.equal(
    result.context.hypothesis,
    "If active agencies receive predictable pricing, annual-plan conversion will increase.",
  );
  assert.equal(
    result.context.primaryMetric,
    "Agency-to-annual-plan conversion rate among agencies with four or more weeks of active usage.",
  );
  assert.doesNotMatch(Object.values(result.context).join(" "), /Based on my review/);
});

const agencyEvidenceBoundaryResponse = `### Opportunity

Media agency localization with collaborative review and predictable pricing.

### Who is this for?

Media agencies running multilingual localization campaigns.

### Why test this?

- **Product:** Agency teams activate quickly and return for repeat localization usage.
- **Customer:** Agencies request collaborative review workflows and predictable pricing.
- **Market:** Agencies need predictable localization pricing and a shared review workflow.

### What should we test?

**Hypothesis:** If agencies receive collaborative review and predictable pricing, pilot conversion will increase.

**Primary metric:** Agency-to-annual-plan conversion rate among agencies with four or more weeks of active usage.

### What could make us wrong?

- Agency demand may vary by campaign volume.

### Other opportunities

**Opportunity:** Enterprise governance package.
**Target segment:** Enterprise compliance teams.
**Why promising:** Enterprise buyers need audit controls and procurement support.

**Opportunity:** Creator monetization package.
**Target segment:** Regional-language creators.
**Why promising:** Creators need lower-volume pricing and monetization tools.`;

test("maps Signal evidence only from the primary opportunity", () => {
  const result = parseGtmOpportunity(agencyEvidenceBoundaryResponse);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));

  const displayEvidence = sourceEvidenceForDisplay(result.context.supportingEvidence);
  assert.equal(
    displayEvidence.product,
    "Agency teams activate quickly and return for repeat localization usage.",
  );
  assert.equal(
    displayEvidence.customer,
    "Agencies request collaborative review workflows and predictable pricing.",
  );
  assert.equal(
    displayEvidence.market,
    "Agencies need predictable localization pricing and a shared review workflow.",
  );
  assert.equal(
    result.context.primaryMetric,
    "Agency-to-annual-plan conversion rate among agencies with four or more weeks of active usage.",
  );

  const fullEvidence = [
    result.context.whyNow,
    result.context.supportingEvidence,
    result.context.contradictingEvidence,
    result.context.keyUnknowns,
    result.context.recommendedGtmMotion,
  ].join(" ");
  assert.match(fullEvidence, /Agency teams activate quickly/);
  assert.doesNotMatch(fullEvidence, /Enterprise|audit controls|Creator|monetization/);
  assert.doesNotMatch(Object.values(result.context).join(" "), /Enterprise governance|Creator monetization/);
});

test("does not backfill a missing primary source from secondary opportunities", () => {
  const withoutPrimaryMarketEvidence = agencyEvidenceBoundaryResponse.replace(
    "- **Market:** Agencies need predictable localization pricing and a shared review workflow.\n",
    "",
  );
  const result = parseGtmOpportunity(withoutPrimaryMarketEvidence);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));

  const displayEvidence = sourceEvidenceForDisplay(result.context.supportingEvidence);
  assert.equal(displayEvidence.market, "Not separated in this brief.");
  assert.doesNotMatch(Object.values(displayEvidence).join(" "), /Enterprise|Creator|monetization/);
});

const attachedPreambleRuntimeResponse = `Let me read the full intelligence documents to get a complete picture.### Opportunity

Offer media agencies a collaborative review workspace with client-facing permissions and predictable campaign pricing to convert active trial users into annual plans.

### Who is this for?

Media agencies running multilingual localization campaigns for multiple clients, who are already using the product weekly but are blocked from annual purchase by missing review controls and unpredictable per-minute pricing.

### Why test this?

- **Product:** Agencies activate collaboratively, return weekly for four consecutive weeks, and produce high volume across campaign assets.
- **Customer:** Agencies request client workspaces, reviewer roles, access controls, precise comments, and predictable pricing.
- **Market:** Shared pronunciation and tone review is an unmet workflow need.

### What should we test?

**Hypothesis:** If we give agency pilots a collaborative review package bundled with predictable pricing, then a higher share of agency pilots will convert to annual plans.

**Primary metric:** Agency-to-annual-plan conversion rate among agencies with four or more weeks of active usage.

### What could make us wrong?

- Market evidence is thin.
- Annual purchase intent depends on successful client outcomes.
- There are no failed pilots in the dataset.

### Other opportunities

**Opportunity:** Build a governance-ready localization package for enterprises.
**Target segment:** Enterprise L&D and compliance teams.
**Why promising:** Strong governance demand.

**Opportunity:** Create a creator monetization plan.
**Target segment:** Regional-language creators.
**Why promising:** Strong creator usage.`;

test("imports the exact 1,701-character runtime response with an attached preamble", () => {
  assert.equal(attachedPreambleRuntimeResponse.length, 1701);
  const result = parseGtmOpportunity(attachedPreambleRuntimeResponse);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));

  assert.equal(
    result.context.opportunity,
    "Offer media agencies a collaborative review workspace with client-facing permissions and predictable campaign pricing to convert active trial users into annual plans.",
  );
  assert.match(result.context.targetSegment, /Media agencies running multilingual localization campaigns/);
  assert.equal(
    result.context.hypothesis,
    "If we give agency pilots a collaborative review package bundled with predictable pricing, then a higher share of agency pilots will convert to annual plans.",
  );
  assert.equal(
    result.context.primaryMetric,
    "Agency-to-annual-plan conversion rate among agencies with four or more weeks of active usage.",
  );

  const evidence = extractSourceEvidence(result.context.supportingEvidence);
  assert.match(evidence.product, /Agencies activate collaboratively/);
  assert.match(evidence.customer, /Agencies request client workspaces/);
  assert.match(evidence.market, /Shared pronunciation and tone review/);
  assert.doesNotMatch(
    Object.values(result.context).join(" "),
    /governance-ready|Enterprise L&D|creator monetization|Regional-language creators/,
  );
});

test("imports an Opportunity heading attached to preamble with a space", () => {
  const result = parseGtmOpportunity(
    attachedPreambleRuntimeResponse.replace("picture.### Opportunity", "picture. ### Opportunity"),
  );
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  assert.match(result.context.opportunity, /Offer media agencies/);
});

test("never selects secondary Opportunity labels after Other opportunities", () => {
  const secondaryOnly = `Introductory prose without a primary section.

### Other opportunities

**Opportunity:** Enterprise governance.
**Target segment:** Enterprise teams.
**Hypothesis:** This secondary idea could convert.
**Primary metric:** Secondary conversion.`;
  const result = parseGtmOpportunity(secondaryOnly);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["Opportunity", "Target segment", "Hypothesis", "Primary metric"]);
});

const completePrimaryA = `### Opportunity
Agency opportunity
### Who is this for?
Media agencies
### What should we test?
**Hypothesis:** Agency hypothesis
### Primary metric
Agency conversion`;

const completePrimaryB = `### Opportunity
Enterprise opportunity
### Who is this for?
Enterprise teams
### What should we test?
**Hypothesis:** Enterprise hypothesis
### Primary metric
Enterprise conversion`;

test("rejects two complete primary opportunities", () => {
  const result = parseGtmOpportunity(`${completePrimaryA}\n${completePrimaryB}`);
  assert.equal(result.ok, false);
  assert.equal(result.missing.length, 0);
  assert.equal(
    result.error,
    "Multiple primary opportunities detected. Please provide one primary opportunity and place additional opportunities under 'Other opportunities'.",
  );
});

test("rejects two primary opportunities even when only one is complete", () => {
  const result = parseGtmOpportunity(`${completePrimaryA}\n### Opportunity\nIncomplete second opportunity`);
  assert.equal(result.ok, false);
  assert.match(result.error, /Multiple primary opportunities detected/);
});

test("rejects three primary opportunities", () => {
  const result = parseGtmOpportunity(
    `${completePrimaryA}\n${completePrimaryB}\n### Opportunity\nCreator opportunity`,
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /Multiple primary opportunities detected/);
});

test("rejects a second Opportunity before the Other opportunities boundary", () => {
  const result = parseGtmOpportunity(
    `${completePrimaryA}\n### Opportunity\nSecond primary\n### Other opportunities\n**Opportunity:** Secondary`,
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /Multiple primary opportunities detected/);
});

test("ignores multiple Opportunity headings after Other opportunities", () => {
  const result = parseGtmOpportunity(
    `${completePrimaryA}\n### Other opportunities\n**Opportunity:** Enterprise secondary\n**Opportunity:** Creator secondary`,
  );
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(result.context.opportunity, "Agency opportunity");
  assert.doesNotMatch(Object.values(result.context).join(" "), /secondary/i);
});

test("keeps a metric exact when followed by closing commentary", () => {
  const result = parseGtmOpportunity(
    `${completePrimaryA}\n\nThanks for reviewing this analysis.`,
  );
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(result.context.primaryMetric, "Agency conversion");
});

test("keeps a metric exact when followed by Other opportunities", () => {
  const result = parseGtmOpportunity(
    `${completePrimaryA}\n### Other opportunities\n**Opportunity:** Enterprise secondary`,
  );
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(result.context.primaryMetric, "Agency conversion");
});

test("supports End decision brief as an explicit terminator", () => {
  const result = parseGtmOpportunity(
    `${completePrimaryA}\n### End decision brief\nThanks for reviewing this analysis.`,
  );
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(result.context.primaryMetric, "Agency conversion");
});

test("keeps a metric exact at the end of the document", () => {
  const result = parseGtmOpportunity(completePrimaryA);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(result.context.primaryMetric, "Agency conversion");
});

test("preserves a contiguous multiline metric", () => {
  const result = parseGtmOpportunity(
    completePrimaryA.replace(
      "Agency conversion",
      "Agency pilot-to-paid conversion\namong accounts active for four weeks",
    ),
  );
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(
    result.context.primaryMetric,
    "Agency pilot-to-paid conversion\namong accounts active for four weeks",
  );
});

test("formats specific required-field errors", () => {
  const cases = [
    ["Opportunity", completePrimaryA.replace("### Opportunity\nAgency opportunity\n", "")],
    ["Target segment", completePrimaryA.replace("### Who is this for?\nMedia agencies\n", "")],
    ["Hypothesis", completePrimaryA.replace("### What should we test?\n**Hypothesis:** Agency hypothesis\n", "")],
    ["Primary metric", completePrimaryA.replace("### Primary metric\nAgency conversion", "")],
  ];

  for (const [field, input] of cases) {
    const result = parseGtmOpportunity(input);
    assert.equal(result.ok, false);
    assert.equal(opportunityParseErrorMessage(result), `Missing required field: ${field}.`);
  }

  const multipleMissing = parseGtmOpportunity("### Opportunity\nAgency opportunity");
  assert.equal(multipleMissing.ok, false);
  assert.equal(
    opportunityParseErrorMessage(multipleMissing),
    "Missing required fields: Target segment, Hypothesis, Primary metric.",
  );
});

const structuredAgentHandoff = `### Opportunity

Position Sarvam Studio as the integrated localization workflow for Indian-language media agencies by combining collaborative pronunciation/tone review, reusable language assets, and predictable campaign pricing to convert successful client pilots into annual contracts.

### Target segment

Indian-language media agencies running multilingual client campaigns across advertising, branded content, and regional localization.

### Hypothesis

IF we offer a structured agency workflow plan combining collaborative pronunciation/tone review, reusable approved terminology, and predictable campaign-based pricing FOR Indian-language media agencies running multilingual client campaigns THEN pilot-to-annual-contract conversion rate will increase BECAUSE collaborative review and pricing predictability are the most repeated unmet needs in agency customer calls, the market identifies shared pronunciation/tone review as a strong unmet workflow opportunity, and product data shows agency conversion follows successful client pilots.

### Primary metric

Pilot-to-annual-contract conversion rate

### Product evidence

Agency conversion follows a successful client pilot. Agencies activate collaboratively by inviting editors and creating campaign projects immediately, return weekly for four consecutive weeks, and convert after demonstrating delivery value across multilingual campaigns.

### Customer evidence

Collaborative review and client workspace controls are repeated agency capability gaps. Pricing predictability is also identified as an obstacle to annual commitment. Purchase intent is conditional on a successful multilingual client pilot.

### Market evidence

Shared pronunciation and tone review across regional campaign variants is identified as an unmet workflow need. Agencies show preference for predictable localization bundles instead of per-minute billing.

### Key unknowns

Agency market evidence is thin. Typical revision volume and bundle economics are unknown. The end client's role in the purchasing decision is also unclear.`;

test("imports the exact structured GTM Intelligence Agent handoff", () => {
  const result = parseGtmOpportunity(structuredAgentHandoff);
  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));

  assert.match(result.context.opportunity, /integrated localization workflow/);
  assert.match(result.context.targetSegment, /Indian-language media agencies/);
  assert.match(result.context.hypothesis, /pilot-to-annual-contract conversion rate will increase/);
  assert.equal(result.context.primaryMetric, "Pilot-to-annual-contract conversion rate");
  assert.match(result.context.keyUnknowns, /Agency market evidence is thin/);

  const evidence = sourceEvidenceForDisplay(result.context.supportingEvidence);
  assert.match(evidence.product, /Agency conversion follows a successful client pilot/);
  assert.match(evidence.customer, /Collaborative review and client workspace controls/);
  assert.match(evidence.market, /Shared pronunciation and tone review/);
  assert.doesNotMatch(Object.values(evidence).join(" "), /Not separated in this brief/);
});

test("structured evidence headings tolerate capitalization, spacing, bullets, and inline values", () => {
  const result = parseGtmOpportunity(`### Opportunity
Agency workflow
### Target segment
Media agencies
### Hypothesis
Conversion will improve
### Primary metric
Pilot conversion
###   PRODUCT EVIDENCE
- Weekly repeat usage
### Customer Evidence: Repeated review requests
### market evidence
* Predictable pricing demand
### KEY UNKNOWNS
- Revision volume is unknown`);

  assert.equal(result.ok, true, result.ok ? "" : result.missing.join(", "));
  const evidence = sourceEvidenceForDisplay(result.context.supportingEvidence);
  assert.equal(evidence.product, "Weekly repeat usage");
  assert.equal(evidence.customer, "Repeated review requests");
  assert.equal(evidence.market, "Predictable pricing demand");
  assert.equal(result.context.keyUnknowns, "Revision volume is unknown");
});
