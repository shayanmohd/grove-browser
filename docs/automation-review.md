# Automation and native behavior review

The September 11, 2026 review exercised Grove's form workflow, document tracking, permissions, and restored state. All form submissions used fictional data on the project's temporary local fixture server. The [main review report](review.md) records the tested environment and suite results.

## Corrected behavior

| Area | Grove's behavior after review |
| --- | --- |
| Document identity | Pending snapshots and prepared clicks or focus operations fail when navigation replaces their document. Refs stay within the top document that produced them. |
| Operation ordering | Requests are queued, target explicit tab IDs, and recheck ownership before input. Disconnected queued requests and remaining batch steps are skipped. |
| New-tab forms | POST bytes, content type, multipart boundary, and referrer reach the new tab. Skill tests verify URL-encoded and multipart forms and exactly one server receipt per submission. |
| Discoverable controls | Snapshots expose submit-input captions, summary disclosures, empty and plaintext-only editable regions, and bounded select options with exact values. Hidden content and editable drafts are excluded from snapshot text. |
| Valid field actions | Fill rejects disabled option groups, duplicate select values, multiple selects, invalid normalized values, and fields replaced or made read only during focus. |
| Time budgets | Wait timeouts include a stalled page evaluation or loading document. Navigation between preparation and native input invalidates the action. |

The native review also corrected separate microphone and camera grants, stale permission responses, duplicate saved identities, restored tab limits, and adjacent-tab selection. Desktop and preview share saved-state validation. The test harness awaits asynchronous state predicates before deciding they passed.

These cases are covered by the [skill test](../scripts/test-skill.mjs), [automation tests](../tests/automation.test.ts), [controller tests](../tests/controller.test.ts), and [persistence tests](../tests/persistence.test.ts). The new-tab form implementation uses Electron's documented [window-open data](https://www.electronjs.org/docs/latest/api/web-contents#contentssetwindowopenhandlerhandler).

## File selection

The file-selection action uses a current snapshot ref for a top-document file input, including a hidden input inside visible upload UI. It accepts 1 to 8 regular files totaling at most 16 MiB and transfers their bytes through the authenticated connection. It does not ask the browser server to read local filesystem paths. One transfer can be pending at a time; only its dedicated route permits 24 MiB of JSON, while other request bodies remain bounded to 64 KiB.

The command selects files and dispatches input and change events, which can trigger a site's automatic upload. Authorization must cover the selected files and destination before selection. Its selected-file count is not a site receipt. Check the site's final result and inspect current state before retrying after an error or timeout. Directories, frames, shadow roots, native file handles, and sites requiring trusted chooser events are outside this action's support. See the [file-selection guide](automation.md#select-files-for-upload) for the exact contract.

## Remaining boundaries

Grove's agent interface covers the top document. It does not provide iframe, shadow-root, raw CDP, or canvas-editor actions. JavaScript alerts, confirms, and prompts require human handling and may block an in-flight action. Temporary agent sessions have their own cookies and logins. File-selection support varies by site.

The executed fixture workflows and public website reads establish behavior for those tested cases. They do not establish compatibility with every site, an independent security certification, or total model billing savings.
