# Review alongside ego-browser

On September 11, 2026, Grove and the installed ego-browser 0.4.7.4 ran on the same Apple Silicon Mac against the same local form fixture. Both created a form, filled fictional response fields, and reached a verified receipt. No live external forms were submitted. Fresh full-page observations from four matching states are recorded in the [token comparison](benchmarks.md).

The public ego repository was reviewed at commit [`d01be93325c7ea59d41c2ca9f4c59b58b4be4046`](https://github.com/citrolabs/ego-lite/tree/d01be93325c7ea59d41c2ca9f4c59b58b4be4046). It contains the automation runtime, skill, documentation, and tests. Its native browser bindings are a separate layer, so this was not a review of the complete browser engine. The source snapshot and installed application have different versions.

## What informed Grove's fixes

| Area | Comparison and resulting Grove change |
| --- | --- |
| Document identity | Ego's [reference map](https://github.com/citrolabs/ego-lite/blob/d01be93325c7ea59d41c2ca9f4c59b58b4be4046/package/ego-browser/src/ref-map.ts) carries frame provenance. Grove retains its top-document scope and now rejects pending snapshots and prepared clicks or focus operations when navigation changes that document. |
| Operation ordering | Ego's [native gate](https://github.com/citrolabs/ego-lite/blob/d01be93325c7ea59d41c2ca9f4c59b58b4be4046/package/ego-browser/src/native-gate.ts) serializes operations that depend on its selected task space. Grove uses explicit tab IDs and a request queue, rechecks ownership before input, and now skips disconnected queued requests and remaining batch steps. |
| Form completeness | A real Electron probe found that Grove turned a new-tab POST submission into a GET. Grove now carries the POST bytes, content type, multipart boundary, and referrer to the new tab. Skill tests verify both encodings and exactly one server receipt per submission. Electron documents this data in its [window-open API](https://www.electronjs.org/docs/latest/api/web-contents#contentssetwindowopenhandlerhandler). |
| Discoverable controls | Grove now exposes submit-input captions, summary disclosures, empty and plaintext-only editable regions, and bounded select options with exact values. Hidden content and editable drafts are excluded from snapshot text. |
| Valid field actions | Grove rejects disabled option groups, duplicate select values, multiple selects, invalid normalized values, and fields replaced or made read only during focus. These cases run through the real skill client in Chromium. |
| Time budgets | Grove's wait timeout now includes a stalled page evaluation or loading document. Tests cover navigation between preparation and native input. |

The native review also corrected separate microphone/camera grants, stale permission responses, duplicate saved identities, restored tab limits, and adjacent-tab selection. Desktop and preview now share saved-state validation. The test harness awaits asynchronous state predicates before deciding they passed.

## Remaining differences

Ego's [JavaScript dialog design](https://github.com/citrolabs/ego-lite/blob/d01be93325c7ea59d41c2ca9f4c59b58b4be4046/docs/native-javascript-dialog-requirement.md) specifies explicit dialog identities and accept/dismiss actions. Grove has no dialog automation action; a native alert, confirm, or prompt can block an action and needs human handling. This limitation is documented in its skill.

Grove also lacks ego's broad frame, raw CDP, file-upload, and visual-editor automation surface. Its temporary agent sessions do not share personal login state. Grove's practical advantages in this review are native build targets for four platform/architecture combinations, a small standalone client, bounded observations, and the tested form fixes. The evidence does not establish universal feature parity, higher web-wide reliability, or lower total model billing.
