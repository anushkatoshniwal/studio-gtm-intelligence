import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);

test("pilot size is operator-owned while preserving the API contract", () => {
  assert.match(pageSource, /pilot_size:\s*string/);
  assert.match(
    pageSource,
    /qualified_accounts:\s*Number\(values\.pilot_size\)/,
  );
  assert.match(pageSource, /inputLabel="Pilot size"/);
  assert.match(
    pageSource,
    /helper="How many qualified accounts do you plan to include in this experiment\?"/,
  );
});

test("decision uses the submitted pilot without exposing a recommendation", () => {
  assert.match(pageSource, /setSimulatedPilotSize\(payload\.qualified_accounts\)/);
  assert.match(
    pageSource,
    /Pilot: \{formatNumber\(pilotSize\)\} \{pilotSize === 1 \? "account" : "accounts"\}/,
  );
  assert.doesNotMatch(pageSource, /recommended_pilot_size/i);
  assert.doesNotMatch(pageSource, /Recommended pilot size/i);
});
