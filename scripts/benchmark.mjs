import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { getEncoding } from "js-tiktoken";

const encoding = getEncoding("o200k_base");
const measure = (text) => ({
  characters: text.length,
  tokens: encoding.encode(text).length,
  sha256: createHash("sha256").update(text).digest("hex"),
});
const fixtures = [];
for (const name of ["form", "created-form", "receipt", "reference"]) {
  const kamapathy = await readFile(
    `tests/fixtures/benchmarks/kamapathy-${name}.txt`,
    "utf8",
  );
  assert.ok(!kamapathy.includes("Truncated."));
  if (name === "reference") {
    for (let index = 1; index <= 18; index++) {
      assert.ok(kamapathy.includes(`Research note ${index}`));
      assert.ok(kamapathy.includes(`Read note ${index}`));
    }
  }
  fixtures.push({
    name,
    kamapathy: measure(kamapathy),
  });
}
const kamapathySkill = {};
for (const name of [
  "SKILL.md",
  "references/actions.md",
  "references/connection.md",
])
  kamapathySkill[name] = measure(
    await readFile(`skills/kamapathy/${name}`, "utf8"),
  );
const result = {
  tokenizer: "o200k_base",
  tokenizerPackage: "js-tiktoken@1.0.21",
  source: "Captured local Chromium observations, normalized loopback port 3000",
  capturedAt: "2026-09-11",
  kamapathyVersion: "0.1.0",
  fixtures,
  totals: {
    kamapathyTokens: fixtures.reduce((sum, item) => sum + item.kamapathy.tokens, 0),
  },
  kamapathySkill,
};
if (process.argv.includes("--write"))
  await writeFile(
    "docs/benchmark-results.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
console.log(JSON.stringify(result, null, 2));
