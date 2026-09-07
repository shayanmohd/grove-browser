#!/usr/bin/env node
import { constants } from "node:fs";
import { open, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HELP = `Grove browser client

Connect: desktop Agent studio > turn on connection > Copy connection details.
Set GROVE_ENDPOINT and GROVE_TOKEN, or GROVE_CONNECTION_FILE for protected JSON.
Credentials never belong in command arguments. Requires Node.js 22.12 or later.

Usage: node grove.mjs <command> [arguments] [--json]

  health                              Check the connection
  spaces                              List accessible spaces
  space create <name>                 Create a background agent space
  space close <space-id>               Close a space and its tabs
  tabs <space-id>                      List tabs in an agent space
  open <space-id> <url>                Open a background tab
  navigate <tab-id> <url>              Navigate a tab
  snapshot <tab-id> [options]          Read bounded page text and control refs
    --full                            Request the larger snapshot mode
    --selector <css>                   Scope the snapshot to one element
    --max-chars <n> --max-controls <n>  Override snapshot bounds
  click <tab-id> <ref-or-selector>     Click a control
  fill <tab-id> <ref-or-selector> --stdin
                                      Read the exact field value from stdin
  press <tab-id> <key> [ref-or-selector]
                                      Press a supported key
  scroll <tab-id> <direction> [pixels] Scroll up, down, left or right
  wait <tab-id> --stdin               Read wait options as JSON from stdin
  batch <tab-id>                      Read an actions array or {actions} JSON
  screenshot <tab-id> <file.png>       Save a viewport PNG without overwriting
  close <tab-id>                      Close a tab
  handoff <space-id>                  Pause automation for human control

Default output is concise text. --json returns compact JSON for programs.
Batch stops at the first failed action. Submitted actions are never retried.
Take a snapshot again after navigation before reusing element refs.
`;

function required(value, label) {
  if (typeof value !== "string" || !value)
    throw new Error(`Missing ${label}. Run help for usage.`);
  return value;
}
function identifier(value) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(required(value, "ID")))
    throw new Error("Invalid space or tab ID.");
  return value;
}
function integer(value, label, minimum = 0) {
  if (!/^\d+$/.test(required(value, label)))
    throw new Error(`${label} must be an integer of at least ${minimum}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum)
    throw new Error(`${label} must be an integer of at least ${minimum}.`);
  return parsed;
}
function target(value) {
  const text = required(value, "element ref or CSS selector");
  return /^@e\d+$/.test(text) ? { ref: text } : { selector: text };
}
const printable = (value) =>
  String(value ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
const line = (value) => printable(value).replace(/\s+/g, " ").trim();

export async function readConnection(env = process.env) {
  let endpoint = env.GROVE_ENDPOINT;
  let token = env.GROVE_TOKEN;
  if (!endpoint && !token && env.GROVE_CONNECTION_FILE) {
    let file;
    try {
      file = await open(
        env.GROVE_CONNECTION_FILE,
        constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
      );
      const metadata = await file.stat();
      if (!metadata.isFile() || metadata.size > 4096)
        throw new Error(
          "Use a regular connection JSON file smaller than 4 KiB.",
        );
      if (
        process.platform !== "win32" &&
        ((metadata.mode & 0o077) !== 0 ||
          (typeof process.getuid === "function" &&
            metadata.uid !== process.getuid()))
      )
        throw new Error(
          "Connection file must belong to your account and have mode 0600 or stricter.",
        );
      const connection = JSON.parse(await file.readFile("utf8"));
      if (
        !connection ||
        typeof connection !== "object" ||
        Array.isArray(connection)
      )
        throw new Error("Invalid connection JSON.");
      endpoint = connection.endpoint;
      token = connection.token;
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error(
          "The connection file must contain valid JSON with endpoint and token fields.",
        );
      throw error;
    } finally {
      await file?.close();
    }
  }
  const parsed = new URL(
    required(endpoint, "GROVE_ENDPOINT or a connection file"),
  );
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    !parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      "GROVE_ENDPOINT must be http://127.0.0.1:<port> with no path or credentials.",
    );
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new Error(
      "Provide the 64-character token from Agent studio through GROVE_TOKEN or the connection file.",
    );
  return { endpoint: parsed, token };
}

async function readInput(stream) {
  if (stream.isTTY)
    throw new Error("Pipe the requested value or JSON into standard input.");
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 65536) throw new Error("Standard input exceeds 64 KiB.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function readJson(stream) {
  try {
    return JSON.parse(await readInput(stream));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("Standard input must be valid JSON.");
    throw error;
  }
}

export function formatSnapshot(snapshot) {
  const lines = [line(snapshot.title) || "Untitled page", line(snapshot.url)];
  if (snapshot.text) lines.push("", printable(snapshot.text).trim());
  if (snapshot.interactables?.length) {
    lines.push("", "Controls:");
    for (const control of snapshot.interactables)
      lines.push(
        `${line(control.ref || control.selector)} ${line(control.role || control.tag)} ${JSON.stringify(line(control.label))}${control.disabled ? " [disabled]" : ""}`,
      );
  }
  if (snapshot.truncated)
    lines.push(
      "",
      "Truncated. Scope with --selector or request --full if needed.",
    );
  return lines.join("\n");
}

export function formatResult(data) {
  if (data && "interactables" in data && "url" in data)
    return formatSnapshot(data);
  if (data?.space)
    return `space ${data.space.id} ${JSON.stringify(line(data.space.name))} ${line(data.space.owner)}`;
  if (data?.tab) return `tab ${data.tab.id} ${line(data.tab.url)}`;
  if (data?.spaces)
    return data.spaces.length
      ? data.spaces
          .map(
            (space) =>
              `${space.id} ${JSON.stringify(line(space.name))} ${line(space.owner)}`,
          )
          .join("\n")
      : "No agent spaces.";
  if (data?.tabs)
    return data.tabs.length
      ? data.tabs
          .map((tab) => `${tab.id} ${line(tab.title)} ${line(tab.url)}`)
          .join("\n")
      : "No tabs.";
  if (Array.isArray(data?.results)) {
    const output = data.results.map((result, index) => {
      const payload = result.snapshot || result.result || result;
      const name = result.type || result.action || "action";
      const detail =
        payload && "interactables" in payload
          ? `\n${formatSnapshot(payload)}`
          : result.ok === false || payload?.ok === false
            ? ` ${line(result.error?.message || result.error || payload.error?.message || payload.error || "failed")}`
            : " ok";
      return `${index + 1}. ${line(name)}${detail}`;
    });
    if (data.ok === false)
      output.push(
        `Stopped at action ${Number(data.failedIndex) + 1}: ${line(data.error?.message || data.error || "failed")}`,
      );
    return output.join("\n");
  }
  if (data?.status)
    return `${line(data.status)}${data.version ? ` Grove ${line(data.version)}` : ""}`;
  if (data?.ok)
    return data.owner === "human"
      ? "ok: human control, automation paused"
      : "ok";
  return JSON.stringify(data);
}

export async function runCli(argv, options = {}) {
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const json = argv.includes("--json");
  const [command = "help", ...args] = argv.filter(
    (argument) => argument !== "--json",
  );
  if (["help", "--help", "-h"].includes(command)) {
    stdout.write(HELP);
    return 0;
  }
  const { endpoint, token } = await readConnection(options.env || process.env);
  let path;
  let method = "GET";
  let body;
  let output;
  switch (command) {
    case "health":
      path = "/health";
      break;
    case "spaces":
      path = "/spaces";
      break;
    case "space":
      if (args[0] === "create") {
        path = "/spaces";
        method = "POST";
        body = { name: required(args[1], "space name") };
      } else if (args[0] === "close") {
        path = `/spaces/${identifier(args[1])}`;
        method = "DELETE";
      } else
        throw new Error("Use space create <name> or space close <space-id>.");
      break;
    case "tabs":
      path = `/spaces/${identifier(args[0])}/tabs`;
      break;
    case "open":
      path = `/spaces/${identifier(args[0])}/tabs`;
      method = "POST";
      body = { url: required(args[1], "URL") };
      break;
    case "navigate":
      path = `/tabs/${identifier(args[0])}/navigate`;
      method = "POST";
      body = { url: required(args[1], "URL") };
      break;
    case "snapshot": {
      path = `/tabs/${identifier(args[0])}/snapshot`;
      body = { mode: "compact" };
      method = "POST";
      for (let index = 1; index < args.length; index++) {
        if (args[index] === "--full") body.mode = "full";
        else if (args[index] === "--selector")
          body.selector = required(args[++index], "CSS selector");
        else if (args[index] === "--max-chars")
          body.maxChars = integer(args[++index], "maximum characters");
        else if (args[index] === "--max-controls")
          body.maxControls = integer(args[++index], "maximum controls");
        else throw new Error(`Unknown snapshot option: ${args[index]}`);
      }
      break;
    }
    case "click":
      path = `/tabs/${identifier(args[0])}/click`;
      method = "POST";
      body = target(args[1]);
      break;
    case "fill":
      if (args[2] !== "--stdin")
        throw new Error(
          "Use fill <tab-id> <ref-or-selector> --stdin and pipe the field value.",
        );
      path = `/tabs/${identifier(args[0])}/fill`;
      method = "POST";
      body = { ...target(args[1]), value: await readInput(stdin) };
      break;
    case "press":
      path = `/tabs/${identifier(args[0])}/press`;
      method = "POST";
      body = {
        key: required(args[1], "key"),
        ...(args[2] ? target(args[2]) : {}),
      };
      break;
    case "scroll":
      path = `/tabs/${identifier(args[0])}/scroll`;
      method = "POST";
      body = {
        direction: required(args[1], "direction"),
        ...(args[2] ? { pixels: integer(args[2], "pixels", 1) } : {}),
      };
      break;
    case "wait":
      if (args[1] !== "--stdin")
        throw new Error(
          "Use wait <tab-id> --stdin and pipe JSON wait options.",
        );
      path = `/tabs/${identifier(args[0])}/wait`;
      method = "POST";
      body = await readJson(stdin);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("Wait options must be a JSON object.");
      break;
    case "batch": {
      path = `/tabs/${identifier(args[0])}/actions`;
      method = "POST";
      const input = await readJson(stdin);
      body = Array.isArray(input) ? { actions: input } : input;
      if (
        !body ||
        !Array.isArray(body.actions) ||
        !body.actions.length ||
        body.actions.length > 20
      )
        throw new Error(
          "Batch input requires an actions array with 1 to 20 actions.",
        );
      break;
    }
    case "screenshot":
      path = `/tabs/${identifier(args[0])}/screenshot`;
      output = resolve(required(args[1], "output PNG path"));
      if (!output.toLowerCase().endsWith(".png"))
        throw new Error("Screenshot output must have a .png extension.");
      break;
    case "close":
      path = `/tabs/${identifier(args[0])}`;
      method = "DELETE";
      break;
    case "handoff":
      path = `/spaces/${identifier(args[0])}/handoff`;
      method = "POST";
      body = {};
      break;
    default:
      throw new Error(`Unknown command: ${command}. Run help for usage.`);
  }
  const encoded = body === undefined ? undefined : JSON.stringify(body);
  if (encoded && Buffer.byteLength(encoded) > 65536)
    throw new Error(
      "Encoded request exceeds 64 KiB. Split the batch or reduce field values.",
    );
  const response = await (options.fetch || fetch)(new URL(path, endpoint), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(encoded ? { "Content-Type": "application/json" } : {}),
    },
    body: encoded,
    redirect: "error",
    signal: AbortSignal.timeout(command === "batch" ? 180000 : 45000),
  });
  if (output && response.ok) {
    if (!response.headers.get("content-type")?.startsWith("image/png"))
      throw new Error("The API did not return a PNG screenshot.");
    await writeFile(output, Buffer.from(await response.arrayBuffer()), {
      flag: "wx",
    });
    stdout.write(
      `${json ? JSON.stringify({ saved: output }) : `saved ${output}`}\n`,
    );
    return 0;
  }
  const data = await response.json().catch(() => null);
  if (Array.isArray(data?.results)) {
    stdout.write(`${json ? JSON.stringify(data) : formatResult(data)}\n`);
    return data.ok === false || !response.ok ? 1 : 0;
  }
  if (!response.ok)
    throw new Error(
      `${response.status} ${line(data?.error?.code || "request_failed")}: ${line(data?.error?.message || "The API request failed.")}`,
    );
  if (data === null) throw new Error("The API did not return valid JSON.");
  stdout.write(`${json ? JSON.stringify(data) : formatResult(data)}\n`);
  return data?.ok === false ? 1 : 0;
}

export async function main(argv = process.argv.slice(2), options = {}) {
  try {
    return await runCli(argv, options);
  } catch (error) {
    let message = error instanceof Error ? error.message : "Command failed.";
    const token = (options.env || process.env).GROVE_TOKEN;
    if (token) message = message.split(token).join("[redacted]");
    if (error?.name === "TimeoutError" || error?.name === "AbortError")
      message =
        "Request timed out. Inspect the page before retrying an action that may have submitted a form.";
    (options.stderr || process.stderr).write(`Grove: ${printable(message)}\n`);
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = await main();
