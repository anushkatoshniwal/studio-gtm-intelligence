# GTM Intelligence Agent → Experiment Lab Handoff

After selecting the single strongest opportunity, return a concise decision brief followed by one structured experiment recommendation. The Agent recommends **what to test**; it must never return GO or NO-GO.

## Concise decision brief

Include only:

1. Primary opportunity
2. Target segment
3. Three strongest evidence points: Product, Customer, and Market
4. Three key risks or unknowns
5. A testable `IF / FOR / THEN / BECAUSE` hypothesis
6. One primary metric

Do not repeat claims, dump source documents, or include citation IDs in user-facing prose.

## Structured experiment recommendation

After the brief, output a valid JSON object in a fenced `json` block using this exact contract:

```json
{
  "opportunity": "One concise opportunity statement",
  "target_segment": "One specific target segment",
  "hypothesis": "IF we ... FOR ... THEN ... BECAUSE ...",
  "primary_metric": "One metric",
  "baseline_conversion": 0.02,
  "baseline_type": "Working assumption",
  "expected_conversion": 0.04,
  "expected_outcome_type": "Working assumption",
  "rationale": "Two or three concise sentences explaining the evidence and clearly identifying modelling assumptions.",
  "pilot_size": 500,
  "evidence_confidence": 4,
  "execution_feasibility": 4,
  "revenue_per_customer": 100000,
  "acquisition_cost": 100000,
  "pilot_cost": 150000,
  "fixed_team_cost": 50000,
  "key_evidence": {
    "product": "Strongest product evidence",
    "customer": "Strongest customer evidence",
    "market": "Strongest market evidence"
  },
  "key_unknowns": [
    "Important unresolved question one",
    "Important unresolved question two"
  ],
  "key_risks": [
    "Important execution or evidence risk"
  ]
}
```

All numeric fields are required so Experiment Lab can prefill an editable model. Use observed values only when they exist in the Knowledge Base. Otherwise supply reasonable modelling values and set `baseline_type` and `expected_outcome_type` to `Working assumption`. Never describe a working assumption as historical performance, a forecast, or validated evidence.

`baseline_conversion` and `expected_conversion` must be decimal rates between `0` and `1`. Confidence and feasibility must be integers from `1` to `5`. Costs and revenue must be non-negative. Pilot size must be a positive whole number.

## Current media-agency opportunity

Use these initial working assumptions for the current media-agency localization recommendation:

- Baseline conversion: `0.02`
- Expected conversion: `0.04`
- Pilot size: `500`
- Evidence confidence: `4`
- Execution feasibility: `4`
- Revenue per customer: `100000`
- Acquisition cost: `100000`
- Pilot cost: `150000`
- Fixed team cost: `50000`

Use this rationale:

> Product evidence shows agency conversion follows successful client pilots, while customer and market evidence consistently identifies collaborative review and pricing predictability as the strongest opportunity. The 2% to 4% conversion lift is a working assumption for experiment modelling, not an observed baseline or forecast.

The operator must be able to edit every imported assumption before Experiment Lab evaluates the opportunity.

## Compatibility

Experiment Lab still accepts the previous concise Markdown decision-brief formats. Markdown-only imports provide context but cannot prefill numerical assumptions; the structured JSON recommendation is the preferred handoff.
