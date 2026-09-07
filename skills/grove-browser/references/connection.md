# Connection setup

The desktop app must be running. Open **Agent studio**, enable its local connection, then choose **Copy connection details**. The web preview has no automation service. The endpoint and token rotate whenever the API restarts.

Use either:

- `GROVE_ENDPOINT` and `GROVE_TOKEN` supplied through the process environment or a secret manager.
- `GROVE_CONNECTION_FILE` naming a user-approved JSON file with `endpoint` and `token` fields containing the copied connection details.

An environment endpoint/token pair takes precedence over a connection file. Do not mix a partial environment pair with a file. The endpoint must be `http://127.0.0.1:<port>` without path, query, or embedded credentials. The token is a 64-character lowercase hexadecimal value. Do not display either a credential file's contents or the token while troubleshooting.

On macOS and Linux, the client requires the connection file to belong to the current user with mode `0600` or stricter. On Windows, store it in the user's private profile with an ACL restricted to that user; portable Node.js mode bits do not verify Windows ACLs. The client rejects oversized files and does not create or discover credential files. Keep the file outside repositories. Remove it when no longer needed.

Run the bundled helper's `health` command to verify access. An authentication failure requires the current connection details, not repeated retries with an old token. If connection details are unavailable, ask the user to enable the connection and supply it through one of these local mechanisms.

The API controls only agent spaces created during its current session or explicitly granted to it through Grove's interface. Personal spaces remain inaccessible. Each agent space has its own temporary session and does not share personal logins. If a website needs authentication, hand the agent space to the user to log in and wait for them to return control.

There is no unauthenticated discovery, MCP connection, Playwright endpoint, or browser-wide JavaScript execution command. Use this helper or Grove's documented HTTP API. Never try to recover access to a paused space by creating a new session or substituting the user's personal browser.
