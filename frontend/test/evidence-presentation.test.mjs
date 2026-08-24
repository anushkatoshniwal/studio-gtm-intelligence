import assert from "node:assert/strict";
import test from "node:test";

import { conciseEvidencePreview } from "../app/evidence-presentation.ts";

test("creates concise extractive Signal copy without changing the evidence", () => {
  const evidence = "Agencies activate collaboratively — they invite editors immediately, return weekly for four consecutive weeks, and produce 42 dubbing minutes across nine campaign assets.";
  const preview = conciseEvidencePreview(evidence);

  assert.equal(preview.headline, "Agencies activate collaboratively");
  assert.match(preview.detail, /weekly for four consecutive weeks/);
  assert.ok(evidence.includes(preview.headline));
  assert.ok(evidence.includes(preview.detail.replace(/…$/, "")));
});

test("uses source evidence rather than opportunity copy", () => {
  const evidence = "Agencies repeatedly ask for client workspaces and reviewer roles; usage-based pricing is hard to forecast.";
  const preview = conciseEvidencePreview(evidence);

  assert.match(preview.headline, /Agencies repeatedly ask/);
  assert.match(preview.detail, /usage-based pricing/);
  assert.doesNotMatch(`${preview.headline} ${preview.detail}`, /collaborative review workspace paired with/);
});

test("preserves the missing-source message", () => {
  assert.deepEqual(conciseEvidencePreview("Not separated in this brief."), {
    headline: "Not separated in this brief.",
    detail: "",
  });
});
