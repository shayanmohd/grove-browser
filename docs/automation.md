# Local automation

Grove exposes an optional local HTTP API for scripts and external agents. It supplies browser tools and a human handoff mechanism. It does not bundle an AI model or autonomously plan tasks.

## Connect

Run the desktop app, open **Agent studio**, turn on the connection, and choose **Copy connection details**. The web preview has no local automation server. Set `GROVE_ENDPOINT` to the displayed `http://127.0.0.1:<port>` address and `GROVE_TOKEN` to the displayed token. Use your shell's environment editor or secret manager. Keep the token out of source control, shell history, screenshots, and command arguments.

The endpoint and token rotate each time the API starts. Every route, including health, requires `Authorization: Bearer <token>`. There is no public discovery file or unauthenticated discovery route. The token grants control of spaces created through that running API server or explicitly granted through the interface, so give it only to trusted local clients.

The bundled CLI uses Node.js built-ins and runs on macOS, Windows, and Linux:

```sh
node scripts/grove.mjs health
node scripts/grove.mjs space create "Documentation research"
```

Copy the returned space ID, then open a page and copy its tab ID:

```sh
node scripts/grove.mjs open <space-id> https://example.com
node scripts/grove.mjs snapshot <tab-id>
node scripts/grove.mjs screenshot <tab-id> ./example.png
node scripts/grove.mjs handoff <space-id>
```

Angle bracket IDs in examples are placeholders to replace with actual IDs. New spaces and tabs open in the background, preserving your current browsing selection. Screenshot files use exclusive creation so an existing file is never overwritten.

## Interact with a page

A snapshot contains the top document's URL, title, visible text, and controls with labels, CSS selectors, and short element references such as `@e1`. Current input, textarea, and contenteditable values are omitted. Text that a website echoes elsewhere remains visible, so snapshots are not a secret-redaction service. Hidden, inert, transparent, and closed disclosure content is excluded. Select controls include option labels, exact values, and disabled states: up to 20 options per select and 100 per snapshot, omitting values longer than 256 characters and setting `truncated` when options are omitted. Scope a select to avoid the shared option budget. Compact mode is the default: 4,000 text characters, 40 controls, and 80-character labels. Full mode raises the defaults to 24,000 text characters, 100 controls, and 200-character labels. Both modes retain the same JSON response shape and a `truncated` flag.

Prefer compact snapshots, scoped snapshots, and element references for short agent conversations. A scoped snapshot observes one uniquely matching CSS selector, such as `form` or `#checkout`. Set `maxChars: 0` for controls only or `maxControls: 0` for text only. Explicit bounds are 0 to 24,000 text characters and 0 to 100 controls. Scope and bounds constrain the result; they do not grant access to additional frames or spaces.

```sh
node scripts/grove.mjs snapshot <tab-id>
node scripts/grove.mjs snapshot <tab-id> --selector '#search-form' --max-chars 1000
node scripts/grove.mjs snapshot <tab-id> --full --json
node scripts/grove.mjs click <tab-id> @e2
node scripts/grove.mjs press <tab-id> Enter
node scripts/grove.mjs navigate <tab-id> https://example.com
```

Element references remain stable while the same document and element remain available. References expire on document navigation, when their element is detached, when the API restarts, or when the bounded reference cache expires. A stale reference fails explicitly and is never looked up again by CSS selector or reassigned to a new element. Take a new snapshot after navigation or a stale-reference error. CSS selectors remain supported for compatibility and must uniquely match.

Clicks require a visible, enabled element and verify that another element does not cover its center. Grove sends fixed native Chromium mouse events to the target tab without selecting that tab or focusing the application. This supports normal form validation and submission. URL-encoded and multipart forms targeting `_blank` preserve their POST body and referrer in a new tab in the same space. Use `tabs SPACE_ID` to discover that tab, then verify its receipt; the submitting tab does not navigate. Click and key actions briefly allow immediate navigation to start, then wait for its load; use an explicit wait condition for a later asynchronous outcome. Actions are never retried automatically.

Fill supports text, search, telephone, URL, email, password, number, date, time, datetime-local, month, and week inputs; textareas; single selects by exact option value; and contenteditable text. Chromium must accept an input value without normalization. Multiple selects, duplicate option values, disabled options or option groups, range inputs, and color inputs fail explicitly. Controls are rechecked after focus handlers run. It focuses the element within its page and dispatches input and change events. File uploads, checkbox values, and radio values are not accepted by fill. Use click for checkboxes and radios. Keyboard input supports Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown, and Space. It can optionally target a ref or selector first. Modifier combinations, shell shortcuts, and arbitrary key sequences are not accepted.

Field values go through standard input, keeping them out of process arguments. The CLI preserves input exactly, including trailing newlines. For a nonsensitive sample value:

```sh
node -e "process.stdout.write('browser architecture')" | node scripts/grove.mjs fill <tab-id> '#search' --stdin
```

For sensitive values, pipe from an appropriate local secret source. The API accepts up to 16,384 characters per field, 2,048 characters per selector, and 64 KiB per request body.

## Batch a short interaction

`POST /tabs/:id/actions` accepts 1 to 20 fixed actions. The server validates the entire plan before running the first step, then executes in order with an ownership check at every step. Successful responses have `{ ok: true, results: [{ index, type, result }] }`. A failure returns the applicable HTTP error status and `{ ok: false, results, failedIndex, error: { code, message } }`. `results` contains completed steps; later steps do not run. If human takeover interrupts the batch, earlier observation contents are withheld.

The CLI reads a batch from standard input, either as an actions array or an object containing `actions`. For example, save this nonsensitive plan to a local JSON file, then run `node scripts/grove.mjs batch <tab-id> < plan.json` in a shell supporting input redirection:

```json
{
  "actions": [
    { "type": "fill", "ref": "@e1", "value": "browser architecture" },
    { "type": "click", "ref": "@e2" },
    { "type": "wait", "selector": "#results", "timeoutMs": 5000 },
    {
      "type": "snapshot",
      "selector": "#results",
      "maxChars": 1600,
      "maxControls": 8
    }
  ]
}
```

Use references from your latest snapshot, not the example references verbatim. On PowerShell, pipe file contents with `Get-Content -Raw plan.json | node scripts/grove.mjs batch <tab-id>`. Do not store secrets in a plan file. Submission must still be authorized by the user before a plan is sent.

Wait observes a uniquely matching visible selector, literal page text, or both. With both, text is checked inside the selected element. The default timeout is 5,000 ms; explicit values range from 0 to 15,000 ms. Zero performs one check with at most 250 ms for the page response. Other wait deadlines include loading and page evaluation. With no condition, wait checks that the document is interactive or complete. Scroll moves the top document up, down, left, or right by 1 to 2,000 pixels, defaulting to 600.

Batch execution has a total 60-second budget. A failure is not a rollback, and a timeout does not prove that an input or form submission was cancelled. Inspect the outcome before retrying a consequential action. A batch reduces request overhead; it does not grant an agent permission to submit forms or send messages.

## Human handoff

`handoff` changes the space owner to human. While under human control, the API cannot inspect, navigate, capture, modify, or delete that space or its tabs. The space remains visible in `GET /spaces` with `owner: "human"`. Resume automation explicitly through Grove's interface. The API has no resume or ownership escalation endpoint.

Taking over blocks subsequent automation operations and prevents pending snapshot results from being returned. It cannot undo a click, navigation, or form submission already dispatched. Agent browsing has side effects like normal browsing, so external agents should still follow their user's instructions before submitting forms or sending messages.

## HTTP routes

All paths are relative to `GROVE_ENDPOINT`. POST requests require `Content-Type: application/json`, including handoff with `{}`. Responses are JSON except screenshots. Errors have the shape `{ "error": { "code": "...", "message": "..." } }`.

| Method | Route                  | Body or response                                                                                       |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/health`              | Status and app version                                                                                 |
| GET    | `/spaces`              | `{ spaces: [...] }` for this API session                                                               |
| POST   | `/spaces`              | `{ "name": "Research" }`, returns `{ space }`                                                          |
| DELETE | `/spaces/:id`          | Closes the space and its tabs                                                                          |
| GET    | `/spaces/:id/tabs`     | `{ tabs: [...] }`                                                                                      |
| POST   | `/spaces/:id/tabs`     | `{ "url": "https://example.com" }`, returns `{ tab }`                                                  |
| POST   | `/spaces/:id/handoff`  | `{}`, returns `{ ok: true, owner: "human" }`                                                           |
| POST   | `/tabs/:id/navigate`   | `{ "url": "https://example.com" }`, returns `{ tab }`                                                  |
| GET    | `/tabs/:id/snapshot`   | Compact `{ tabId, url, title, text, interactables, truncated }`                                        |
| POST   | `/tabs/:id/snapshot`   | `{ "mode": "compact", "selector": "#form", "maxChars": 1000, "maxControls": 10 }`; all fields optional |
| GET    | `/tabs/:id/screenshot` | PNG of the current page viewport                                                                       |
| POST   | `/tabs/:id/click`      | `{ "ref": "@e2" }` or `{ "selector": "#submit" }`                                                      |
| POST   | `/tabs/:id/fill`       | `{ "ref": "@e1", "value": "Grove" }`; selector also supported                                          |
| POST   | `/tabs/:id/press`      | `{ "key": "Enter" }`; optional ref or selector                                                         |
| POST   | `/tabs/:id/scroll`     | `{ "direction": "down", "pixels": 600 }`                                                               |
| POST   | `/tabs/:id/wait`       | `{ "selector": "#results", "text": "Complete", "timeoutMs": 5000 }`; fields optional                   |
| POST   | `/tabs/:id/actions`    | `{ "actions": [...] }`; fixed sequential actions with partial progress                                 |
| DELETE | `/tabs/:id`            | Closes the tab                                                                                         |

Navigation accepts only complete HTTP or HTTPS URLs without embedded credentials. Paths do not accept query strings or encoded segments. The server limits its managed spaces to 12, tabs to 20 per space, and concurrent pending requests to 16. Page operations wait up to 15 seconds for loading and another 15 seconds for a response. A timeout does not guarantee a page action was cancelled; inspect the page before retrying a consequential action.

## Isolation and limitations

- The server binds only to `127.0.0.1` on an available random port. It validates the exact Host header and rejects Origin and Sec-Fetch-Site headers, so browser-origin requests are not supported. There is no CORS access.
- The token is generated from 32 random bytes and compared with a constant-time comparison when lengths match. It is held in application memory and provided only to the trusted app interface.
- Spaces created through the current API server are accessible. A space created in the interface starts under human control; choose **Let agent continue** to grant the running API access to it. Personal spaces remain outside its authority. Restarting the API does not reclaim older spaces unless you explicitly grant access again.
- Each agent space uses its own temporary browser session. Personal cookies and login state are not shared. Log into websites inside the agent space if needed. Agent browsing is excluded from persisted browser session, history, and activity state.
- Page observation and DOM preparation run fixed functions in an [Electron isolated JavaScript world](https://www.electronjs.org/docs/latest/api/web-contents#contentsexecutejavascriptinisolatedworldworldid-scripts-usergesture). Native clicks and keys use only fixed internal Chromium input commands. There is no arbitrary JavaScript, CDP, Node.js, shell, filesystem, or browser-wide debugging endpoint. Native input reports a conflict if developer tools are already attached to the tab.
- Snapshots are bounded DOM summaries, not accessibility tree exports. They do not enter iframes, shadow roots, PDF documents, canvas interfaces, or closed components. Screenshots capture the viewport, not the full scrolling page. JavaScript alert, confirm, and prompt dialogs have no automation action and may block a pending page action. Use human handoff to resolve them. Site compatibility varies.
- Grove does not implement Playwright or Chrome DevTools Protocol compatibility, an MCP server, scheduling, model inference, or a built-in agent runtime. Use the documented HTTP routes or CLI from your own automation program.
- Agent spaces deny browser permission requests and downloads, including while under human control.
- Activity records describe operations without recording filled values. Page content is untrusted data and should not be treated as instructions by an external agent.

Use `node scripts/grove.mjs help` to see every CLI command.
