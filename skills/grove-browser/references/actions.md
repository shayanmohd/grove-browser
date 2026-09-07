# Page actions

Run `node scripts/grove.mjs help` for CLI syntax. Resolve that path from this skill directory. Commands accept `--json` for compact machine-readable responses; default text omits repeated metadata. `space create` and `open` return IDs for subsequent commands.

## Form batches

Pipe a JSON object with an `actions` array, or the array itself, into `batch TAB_ID`. Use a safely written temporary file or structured stdin tool input. Avoid shell interpolation of field values. Do not put sensitive values in command arguments, shell history, or source control.

For an authorized form submission, after observing these example refs on the actual page:

```json
{
  "actions": [
    { "type": "fill", "ref": "@e4", "value": "Avery" },
    { "type": "fill", "ref": "@e5", "value": "avery@example.com" },
    { "type": "click", "ref": "@e7" },
    { "type": "wait", "selector": "#confirmation", "text": "Saved", "timeoutMs": 5000 },
    { "type": "snapshot", "selector": "#confirmation", "maxChars": 1200, "maxControls": 10 }
  ]
}
```

`node scripts/grove.mjs batch TAB_ID` reads that JSON from stdin. All actions run sequentially on that tab. A batch may contain 1 to 20 actions and at most 64 KiB of encoded JSON. Do not guess a future ref inside a batch. A snapshot action's newly returned refs can be used in the next client request. Stable selectors are useful across a known navigation followed by a wait.

Each completed entry has `{index,type,result}`. On failure the response has `ok:false`, `results`, `failedIndex`, and `error`; the CLI exits with status 1 while preserving completed results. Indices in JSON are zero-based; text output numbers actions from 1. A failed batch does not roll back prior actions. Continue only after checking which steps actually happened.

## Supported actions

| Type | Fields | Behavior |
| --- | --- | --- |
| `snapshot` | `mode?`, `selector?`, `maxChars?`, `maxControls?` | Read visible text and controls, optionally scoped to a unique element |
| `click` | exactly one of `ref` or `selector` | Click one visible, enabled element |
| `fill` | `ref` or `selector`, `value` | Replace input, textarea, select value, or editable text |
| `press` | `key`, optional `ref` or `selector` | Press a supported key, optionally targeting a control |
| `scroll` | `direction`, optional `pixels` | Scroll up, down, left or right |
| `wait` | `selector?`, `text?`, `timeoutMs?` | Wait for a visible element, text, or both |

Compact snapshots default to 4,000 text characters and 40 controls. Full snapshots default to 24,000 characters and 100 controls. Hard bounds are 0 to 24,000 characters and 0 to 100 controls. `--full` increases the budget while keeping concise text output. `--max-chars` and `--max-controls` override budgets; use zero controls for reading-only tasks. Check `truncated` before assuming a snapshot covers everything needed.

Refs such as `@e4` remain tied to the same element and document and are not reused for a different target. Navigation or replacing that element makes them stale. CSS selectors must match exactly one visible element. Fill does not accept file inputs, checkboxes, or radio buttons; use click for the latter two. Field values are limited to 16,384 characters and selectors to 2,048 characters.

Supported keys: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`, `Space`. Modifier combinations are unsupported. Scroll pixels default to 600 and range from 1 to 2,000. Wait timeouts default to 5,000 ms and range from 0 to 15,000 ms. With both selector and text, the text must occur inside the selected element. Use observable waits instead of arbitrary sleep delays.

Single-action equivalents include `click TAB_ID @e4`, `press TAB_ID Enter @e4`, `scroll TAB_ID down 600`, and `wait TAB_ID --stdin` with JSON options. A single fill takes raw text through stdin, whereas batch values are JSON strings. The client preserves fill input exactly, including trailing newlines.

## Verification and scope

After a submission, check a confirmation element, changed page state, or another outcome tied to the user's task. Do not treat the absence of an error as confirmation. If a request times out, its side effects may still have happened. Inspect before retrying any consequential action.

`handoff SPACE_ID` pauses all API page access for that space. A human takeover interrupts subsequent batch actions. Already dispatched clicks or submissions cannot be undone by the API. `409 human_control` means stop and wait for the user to explicitly resume. Do not try to bypass it.

Snapshots do not enter iframe documents, shadow roots, PDF internals, or canvas interfaces. Screenshot files contain only the current viewport. There is no arbitrary script evaluation, file upload, or personal-session access command.
