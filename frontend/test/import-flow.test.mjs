import assert from "node:assert/strict";
import test from "node:test";

import { JSDOM } from "jsdom";
import { register } from "tsx/esm/api";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  Event: dom.window.Event,
  MouseEvent: dom.window.MouseEvent,
  getComputedStyle: dom.window.getComputedStyle,
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
dom.window.HTMLElement.prototype.scrollIntoView = () => {};

register();

const React = (await import("react")).default;
globalThis.React = React;
const { cleanup, fireEvent, render, screen, waitFor } = await import(
  "@testing-library/react"
);
const userEvent = (await import("@testing-library/user-event")).default;
const pageModule = await import("../app/page.tsx");
const Home = pageModule.default?.default ?? pageModule.default;

const recommendation = {
  opportunity: "Position Sarvam Studio as the integrated localization workflow for Indian-language media agencies by combining collaborative pronunciation/tone review, reusable language assets, and predictable campaign pricing to convert successful client pilots into annual contracts.",
  target_segment: "Indian-language media agencies running multilingual client campaigns across advertising, branded content, and regional localization.",
  hypothesis: "IF we offer a structured agency workflow plan FOR Indian-language media agencies THEN pilot-to-annual-contract conversion will increase BECAUSE collaborative review and pricing predictability are the strongest repeated needs.",
  primary_metric: "Pilot-to-annual-contract conversion rate",
  baseline_conversion: 0.02,
  baseline_type: "Working assumption",
  expected_conversion: 0.04,
  expected_outcome_type: "Working assumption",
  rationale: "Product evidence shows agency conversion follows successful client pilots, while customer and market evidence consistently identifies collaborative review and pricing predictability as the strongest opportunity. The 2% to 4% conversion lift is a working assumption for experiment modelling, not an observed baseline or forecast.",
  pilot_size: 500,
  evidence_confidence: 4,
  execution_feasibility: 4,
  revenue_per_customer: 100000,
  acquisition_cost: 100000,
  pilot_cost: 150000,
  fixed_team_cost: 50000,
  key_evidence: {
    product: "Agency conversion follows a successful client pilot.",
    customer: "Collaborative review and pricing predictability are repeated agency needs.",
    market: "Shared pronunciation and tone review is an unmet workflow need.",
  },
  key_unknowns: ["Agency market evidence is thin."],
  key_risks: ["The end client's role in the purchasing decision is unclear."],
};

const completeAgentResponse = `### Primary opportunity

${recommendation.opportunity}

### Target segment

${recommendation.target_segment}

### Experiment recommendation

\`\`\`
${JSON.stringify(recommendation, null, 2)}
\`\`\``;

function simulationResponse(expectedConversion) {
  const edited = expectedConversion === 0.05;
  return {
    current_customers: 10,
    expected_customers: edited ? 25 : 20,
    incremental_customers: edited ? 15 : 10,
    baseline_revenue: 1000000,
    expected_revenue: edited ? 2500000 : 2000000,
    incremental_revenue: edited ? 1500000 : 1000000,
    total_incremental_cost: 300000,
    incremental_roi: edited ? 400 : 233.33,
    break_even_incremental_customers: 3,
    break_even_expected_conversion_rate: 0.026,
    decision: "GO",
    reasons: ["Expected conversion is comfortably above break-even."],
    risks: ["The baseline is a working assumption."],
  };
}

test("rendered import transfers the structured recommendation into the actual form and evaluates", async () => {
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(init.body);
    requests.push(payload);
    return new Response(
      JSON.stringify(simulationResponse(payload.expected_conversion_rate)),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const user = userEvent.setup({ document: dom.window.document });
  render(React.createElement(Home));

  await user.click(screen.getByRole("button", { name: "Start with a GTM decision brief" }));
  fireEvent.change(screen.getByLabelText("Paste structured experiment recommendation"), {
    target: { value: completeAgentResponse },
  });
  await user.click(screen.getByRole("button", { name: "Import opportunity" }));

  assert.ok(screen.getByText(recommendation.opportunity));
  assert.ok(screen.getByText(recommendation.target_segment));
  assert.equal(screen.getByLabelText("Baseline conversion").value, "0.02");
  assert.equal(screen.getByLabelText("Expected conversion rate").value, "0.04");
  assert.equal(screen.getByLabelText("Pilot size").value, "500");
  assert.equal(screen.getByLabelText(/Evidence confidence/).value, "4");
  assert.equal(screen.getByLabelText(/Execution feasibility/).value, "4");
  assert.equal(screen.getByLabelText(/^Baseline type/).value, "working");
  assert.equal(screen.getByLabelText(/^Expected outcome type/).value, "working");
  assert.equal(screen.getByLabelText(/^Why do we believe this\?/).value, recommendation.rationale);
  assert.equal(screen.getByLabelText(/^Revenue per customer/).value, "100000");
  assert.equal(screen.getByLabelText(/^Acquisition cost/).value, "100000");
  assert.equal(screen.getByLabelText(/^Pilot cost/).value, "150000");
  assert.equal(screen.getByLabelText(/^Fixed team cost/).value, "50000");

  await user.click(screen.getByRole("button", { name: "Evaluate Experiment" }));
  await waitFor(() => assert.equal(requests.length, 1));
  assert.equal(requests[0].current_conversion_rate, 0.02);
  assert.equal(requests[0].expected_conversion_rate, 0.04);
  assert.equal(requests[0].qualified_accounts, 500);
  assert.equal(requests[0].evidence_confidence, 4);
  assert.equal(requests[0].feasibility, 4);
  assert.ok(screen.getByText("233.33%"));
  assert.ok(screen.getAllByText("10").length >= 1);
  assert.ok(screen.getAllByText("GO").length >= 1);

  fireEvent.change(screen.getByLabelText("Expected conversion rate"), {
    target: { value: "0.05" },
  });
  await user.click(screen.getByRole("button", { name: "Evaluate Experiment" }));
  await waitFor(() => assert.equal(requests.length, 2));
  assert.equal(requests[1].expected_conversion_rate, 0.05);
  assert.ok(screen.getByText("400%"));
  assert.ok(screen.getAllByText("15").length >= 1);

  cleanup();
});
