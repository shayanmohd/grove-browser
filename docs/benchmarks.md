# Snapshot token comparison

On September 7, 2026, Grove's full snapshot output used **1,574 tokens** across four local fixture pages, compared with **3,091 tokens** from ego-browser 0.4.7.3: a **49.1% reduction** under the `o200k_base` tokenizer.

| Same local page and state | ego-browser tokens | Grove tokens | Reduction |
| --- | ---: | ---: | ---: |
| Form builder | 290 | 138 | 52.4% |
| Created response form | 447 | 226 | 49.4% |
| Successful submission receipt | 368 | 155 | 57.9% |
| Reference page with 18 notes | 1,986 | 1,055 | 46.9% |
| Total | 3,091 | 1,574 | 49.1% |

## Method

Both browsers visited the same locally hosted [fixture](../tests/fixtures/form-site.mjs) on an Apple Silicon Mac running macOS 15.7.2. ego-browser reported version 0.4.7.3 with Chromium 150.0.7871.101. Grove was version 0.1.0 with Electron 44.2.0. Both created a form, filled fictional response data, submitted it, and observed the confirmation.

The baseline used ego-browser's default full-page `snapshotText()`. Grove used its skill client's `snapshot TAB_ID --full` plain-text output. Its 24,000-character and 100-control budgets did not truncate any page. The reference snapshot includes all 18 note headings and all 18 note links in both outputs. Dynamic local ports were normalized to `3000` before counting. Whitespace, refs, and output formatting were otherwise preserved.

The [captured observations](../tests/fixtures/benchmarks) contain only this project's synthetic pages. The [machine-readable results](benchmark-results.json) record token counts, character counts, and SHA-256 hashes. Recalculate them with:

```sh
npm ci
node scripts/benchmark.mjs
```

To collect a fresh Grove run, build the app and run `npm run test:skill`. It writes observations to ignored `artifacts/review`. To compare another ego-browser version, run `node scripts/review-session.mjs` in an interactive terminal and visit its printed local origin with that version's documented skill. Observe `/forms/new`, create and submit a form, and observe `/benchmark` with `snapshotText()`. Press Enter in the review session to close its fixture and temporary browser. Keep the printed connection file outside the repository and never copy its token into results.

## Skill instruction cost

The Grove entrypoint was 717 tokens. Its action reference added 1,147 and its connection reference added 438, for 2,302 tokens if all three files were read. The installed ego-browser skill entrypoint was 4,659 tokens. Its hash is recorded in the results; its third-party skill text is not redistributed here. Set `EGO_SKILL_FILE` to an authorized local skill path when running the benchmark script to measure another installed copy.

This is a comparison of instruction and observation text sizes. It excludes model reasoning, generated commands, tool schemas, screenshots, caches, and application billing. It does not measure overall task token consumption, latency, memory, or reliability across the web. Grove's compact default and scoped observations can return less text, but those were not used to inflate this full-page comparison.

The outputs have different semantics. ego-browser provides a richer semantic tree, locator metadata, and more automation capabilities. Grove provides a bounded top-document DOM summary with short control refs, and omits current input values. Lower text size does not imply feature parity. Grove does not automate iframes, shadow roots, canvas editors, or file uploads. The ego form run needed an explicit scroll before its below-viewport dynamic-field button could be clicked; Grove's tested click handler scrolled to the control. That single fixture result is not a general reliability ranking.
