# Security model

Grove is an early desktop browser project. It uses Electron's Chromium engine and isolation controls, but it has not been independently audited. This document describes the implementation boundaries and remaining limitations.

## Remote pages and browser controls

Remote pages run in native `WebContentsView` instances with Node.js integration disabled, context isolation enabled, and renderer sandboxing enabled. Only the local browser shell receives the preload bridge. Remote content must not receive native browser actions or access to the automation token.

The address bar accepts HTTP and HTTPS pages, search text, and the internal new tab destination. Unsupported schemes and credential bearing URLs are rejected. Loopback HTTP addresses remain available for local development. These controls do not classify the trustworthiness of a website.

Native IPC checks the sending renderer and its main frame. Website popups open as browser tabs. Personal spaces ask for site permissions through a native prompt. Microphone and camera grants are separate, tied to the requesting origin and session. Pending permission responses are rejected after their space is deleted or the page changes. Agent spaces deny permission requests and downloads.

## Spaces and local data

Personal spaces have persistent, separate Electron session partitions. Agent spaces start in fresh temporary partitions and do not reuse personal cookies. Space isolation does not isolate operating system accounts or provide a separate virtual machine.

Bookmarks, history, settings, and restored personal tabs are written to the app's user data directory. Chromium stores cookies and site storage within that profile. Grove does not add an encrypted vault for application state. Downloaded files remain on disk after a space or tab closes. Clearing history does not erase downloaded files, cookies, or other site storage.

The activity feed is visible runtime state, not an immutable audit log. An application restart clears it. Avoid treating it as evidence that all activity on a page has been recorded.

## Optional automation

The automation API is disabled by default and is started through the browser settings. It binds to `127.0.0.1` on a random available port and requires a random 256 bit bearer token. The server validates the HTTP Host header, rejects browser Origin and Sec-Fetch requests, and does not enable CORS. The token is available through a dedicated shell bridge method and is excluded from general state, persistence, and activity messages.

The API can access spaces it created and agent spaces the user explicitly grants to that running connection. Page reads and actions require agent ownership. The UI exposes activity and lets the user take control, after which subsequent agent operations in that space are denied until the user resumes the agent in the interface.

The API supports bounded DOM snapshots, navigation, trusted clicks and keys, field filling, scrolling, conditional waits, sequential batches, and viewport screenshots. It does not expose arbitrary JavaScript evaluation, Node.js, or a general filesystem interface. Its DOM operations cover the main document; iframe and shadow DOM automation are not implemented. Batches check ownership between steps and report completed actions when a later action fails. Navigation invalidates refs and cancels prepared snapshot, focus, or click results that belong to the previous document. Snapshots omit draft field values, but website text can echo them, so this is not comprehensive redaction.

Treat the connection token as a local secret. Anyone who can use a valid token can exercise the API's allowed capabilities. Do not paste it into source control, screenshots, public issues, website forms, or remote service logs. Loopback binding is not a defense against an already compromised local account.

Temporary sessions prevent passive sharing of personal sign ins. They do not undo actions an agent performs on a remote website. A form submission or purchase remains an external action. Review the [automation guide](automation.md) for the precise endpoints, ownership checks, and validation limits.

## Release work

Development artifacts are unsigned and are not automatically updated. Keep Electron and other dependencies current during development. A production release still needs operating system signing, macOS notarization, an update policy, broader operating system testing, and a security review of browser and automation boundaries.

Grove does not currently provide an extension permission model, credential manager, phishing reputation service, or audited privacy mode. Its separate spaces are not a claim of anonymous browsing.

## Reporting a vulnerability

Use the repository's private vulnerability reporting feature if it is available. Otherwise contact the repository owner through their published contact details and ask for a private reporting channel. Do not publish exploit details or personal profile data in a public issue before maintainers have had a chance to assess the report.

Include the affected Grove version, operating system, minimal reproduction steps using nonpersonal test data, and the boundary you believe is bypassed. Never attach a real browser profile, session cookie, or automation token.
