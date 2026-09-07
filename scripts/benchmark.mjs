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
  const ego = await readFile(
    `tests/fixtures/benchmarks/ego-${name}.txt`,
    "utf8",
  );
  const grove = await readFile(
    `tests/fixtures/benchmarks/grove-${name}.txt`,
    "utf8",
  );
  assert.ok(!grove.includes("Truncated."));
  if (name === "reference")
    for (let index = 1; index <= 18; index++)
      for (const output of [ego, grove]) {
        assert.ok(output.includes(`Research note ${index}`));
        assert.ok(output.includes(`Read note ${index}`));
      }
  const baseline = measure(ego),
    candidate = measure(grove);
  fixtures.push({
    name,
    ego: baseline,
    grove: candidate,
    reductionPercent: Number(
      (100 * (1 - candidate.tokens / baseline.tokens)).toFixed(1),
    ),
  });
}
const groveSkill = {};
for (const name of [
  "SKILL.md",
  "references/actions.md",
  "references/connection.md",
])
  groveSkill[name] = measure(
    await readFile(`skills/grove-browser/${name}`, "utf8"),
  );
const result = {
  tokenizer: "o200k_base",
  tokenizerPackage: "js-tiktoken@1.0.21",
  source: "Captured local Chromium observations, normalized loopback port 3000",
  fixtures,
  totals: {
    egoTokens: fixtures.reduce((sum, item) => sum + item.ego.tokens, 0),
    groveTokens: fixtures.reduce((sum, item) => sum + item.grove.tokens, 0),
  },
  groveSkill,
};
result.totals.reductionPercent = Number(
  (100 * (1 - result.totals.groveTokens / result.totals.egoTokens)).toFixed(1),
);
if (process.env.EGO_SKILL_FILE)
  result.egoSkill = measure(await readFile(process.env.EGO_SKILL_FILE, "utf8"));
if (process.argv.includes("--write"))
  await writeFile(
    "docs/benchmark-results.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
console.log(JSON.stringify(result, null, 2));
