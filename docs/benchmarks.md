# Snapshot size measurements

Grove's full snapshot output uses **1,605 tokens** across four captured local fixture pages under the `o200k_base` tokenizer. These observations were recorded on September 11, 2026, using Grove 0.1.0 on an Apple Silicon Mac running macOS 15.7.2 and Electron 44.2.0.

| Page and state | Snapshot tokens |
| --- | ---: |
| Form builder | 148 |
| Created response form | 247 |
| Successful submission receipt | 155 |
| Reference page with 18 notes | 1,055 |
| Total | 1,605 |

## What is measured

The [local fixture](../tests/fixtures/form-site.mjs) includes a working form builder and response handler. The skill created a form, filled fictional data, submitted a response, and observed the confirmation.

Each capture is the skill client's `snapshot TAB_ID --full` plain-text output. Its 24,000-character and 100-control budgets did not truncate these pages. The reference snapshot includes all 18 note headings and all 18 note links. Dynamic loopback ports were normalized to `3000` before counting. Whitespace, refs, and output formatting were otherwise preserved.

The [captured observations](../tests/fixtures/benchmarks) contain only the project's synthetic pages. The [machine-readable results](benchmark-results.json) record token counts, character counts, and SHA-256 hashes. Recalculate them with:

```sh
npm ci
node scripts/benchmark.mjs
```

Use `node scripts/benchmark.mjs --write` to refresh the JSON report from the committed fixtures and current skill instructions. The script checks for truncation and verifies that all reference notes and links remain present.

## Collect a fresh run

Build the app and run `npm run test:skill`. It writes observations to ignored `artifacts/review`. Inspect those files before replacing committed captures. Normalize the temporary loopback port, record the application version and capture date, and recalculate the report.

For an interactive review, run `node scripts/review-session.mjs` in a terminal. Use its printed local origin and protected connection file with the Grove skill. Press Enter in the review session to close the temporary browser and fixture. Keep connection files outside the repository and never include their tokens in captured results.

## Skill instruction size

The same script measures the current skill entrypoint and its two reference documents. It records each file independently in the JSON report, since agents only need to read the references relevant to their task. These instruction counts can change when the skill is updated, while the dated fixture captures remain the same.

## Practical limits

These numbers describe observation and instruction text sizes. They exclude model reasoning, generated commands, tool schemas, screenshots, caching, and application billing. They do not measure total task token consumption, latency, memory use, or reliability across the web.

Grove provides a bounded summary of the top document with short control refs, exact select option values, and disabled states. It omits current input values and editable drafts. The compact default and scoped observations can return less text than the full snapshots measured here. Lower output size alone does not establish completeness or success on a particular task.
