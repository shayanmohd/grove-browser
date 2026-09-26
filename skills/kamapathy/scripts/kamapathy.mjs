#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, rm, writeFile } from "node:fs/promises";
import { Agent, request as httpRequest } from "node:http";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const HELP = `Kamapathy browser client

Kamapathy connects automatically. Each command finds Kamapathy on this
computer and starts it when agent access was left on. The switch in Settings,
under Agents, turns access off. Set KAMAPATHY_USER_DATA to use another profile.
Requires Node.js 22.12 or later.

Usage: node kamapathy.mjs <command> [arguments] [--json]

  health                              Check the connection
  spaces                              List accessible spaces
  space create <name> [--isolated]    Create a background agent space, with
                                      its own sign-ins when --isolated is given
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
  upload <tab-id> <ref> <file> [files] Select up to 8 files, 16 MiB total
  press <tab-id> <key> [ref-or-selector]
                                      Press a supported key
  drag <tab-id> <source> <target>     Drag one element onto another (refs or selectors)
  scroll <tab-id> <direction> [pixels] [ref-or-selector]
                                      Scroll up, down, left or right: the page,
                                      the panel holding a control, or the panel
                                      in the middle when the page cannot scroll
  wait <tab-id> --stdin               Read wait options as JSON from stdin
  batch <tab-id>                      Read an actions array or {actions} JSON
  screenshot <tab-id> <file.png>       Save a viewport PNG without overwriting
  close <tab-id>                      Close a tab
  handoff <space-id>                  Pause automation for human control
  resume <space-id>                   Take control back when the person says to continue
  run <file.mjs>                      Run a script with the connected client as
                                      the globals kamapathy, createSpace, space
                                      and spaces; run - reads it from stdin and
                                      run -e <code> runs the code itself

Default output is concise text. --json returns compact JSON for programs.
Batch stops at the first failed action. Submitted actions are never retried.
Take a snapshot again after navigation before reusing element refs. A ref
follows a control the page draws again only when that control is unmistakable.
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
export function target(value) {
  const text = required(value, "element ref or CSS selector");
  return /^@e\d+$/.test(text) ? { ref: text } : { selector: text };
}
const printable = (value) =>
  String(value ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
const line = (value) => printable(value).replace(/\s+/g, " ").trim();

const SANDBOX_HINT =
  "Kamapathy refused the connection (permission denied). If an agent sandbox runs this command, allow local sockets or run it outside the sandbox.";

// Mirrors electron/agent-socket.ts: each Kamapathy profile keeps its agent
// rendezvous in <userData>/agent, a folder only this account can open.
export function agentPaths(env = process.env, platform = process.platform) {
  const home = env.HOME || env.USERPROFILE || homedir();
  const userData = env.KAMAPATHY_USER_DATA
    ? resolve(env.KAMAPATHY_USER_DATA)
    : platform === "darwin"
      ? join(home, "Library", "Application Support", "Kamapathy")
      : platform === "win32"
        ? join(env.APPDATA || join(home, "AppData", "Roaming"), "Kamapathy")
        : join(env.XDG_CONFIG_HOME || join(home, ".config"), "Kamapathy");
  const directory = join(userData, "agent");
  return {
    userData,
    directory,
    endpoint: join(directory, "endpoint"),
    off: join(directory, "off"),
    launch: join(directory, "launch.json"),
  };
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function privateDirectory(directory) {
  if (process.platform === "win32") return;
  const metadata = await lstat(directory);
  if (
    !metadata.isDirectory() ||
    metadata.uid !== process.getuid() ||
    (metadata.mode & 0o077) !== 0
  )
    throw new Error(
      "Kamapathy's agent folder must be a private directory owned by your account.",
    );
}

// Returns null when the file does not exist. Anything present must be a small,
// private regular file: a link or a file others can write is refused.
async function readPrivate(path, limit) {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error?.code === "ELOOP")
      throw new Error(`${basename(path)} in Kamapathy's agent folder must not be a link.`);
    throw error;
  }
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > limit)
      throw new Error(`${basename(path)} in Kamapathy's agent folder is not a small regular file.`);
    if (
      process.platform !== "win32" &&
      ((metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid())
    )
      throw new Error(
        `${basename(path)} in Kamapathy's agent folder must belong to your account with mode 0600.`,
      );
    return await file.readFile("utf8");
  } finally {
    await file.close();
  }
}

// The socket's folder is checked separately: it must be private to this account.
export function checkSocket(value, paths, platform = process.platform) {
  const socket = String(value ?? "").trim();
  if (platform === "win32") {
    if (!/^\\\\\.\\pipe\\kamapathy-[a-f0-9]{32}$/.test(socket))
      throw new Error("Kamapathy's agent endpoint is not a Kamapathy pipe.");
    return socket;
  }
  if (!isAbsolute(socket) || basename(socket) !== "kamapathy.sock")
    throw new Error("Kamapathy's agent endpoint must be a kamapathy.sock socket in a private folder.");
  return socket;
}

class IdentityError extends Error {}

// Kamapathy answers health outside its action queue with the instance it
// published. Anything else at the socket or pipe, or nothing answering in
// time, is treated as not running, and no command is sent to it.
async function answers(connection, timeoutMs = 5000) {
  try {
    const response = await socketFetch(connection)("/health", {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch (error) {
    if (error instanceof IdentityError) return false;
    if (["ENOENT", "ECONNREFUSED"].includes(error?.code)) return false;
    if (
      ["AbortError", "TimeoutError"].includes(error?.name) ||
      String(error?.code).startsWith("HPE_")
    )
      return false;
    // Something accepted the connection and then dropped it: Kamapathy at its
    // connection limit. Starting another Kamapathy would not help.
    if (["ECONNRESET", "EPIPE"].includes(error?.code))
      throw new Error("Kamapathy is busy. Retry shortly.");
    if (["EACCES", "EPERM"].includes(error?.code)) throw new Error(SANDBOX_HINT);
    throw error;
  }
}

// Editors such as VS Code set ELECTRON_RUN_AS_NODE for their terminals. Kamapathy
// launched with it runs as plain Node and exits, so it is never passed on.
// AppImage and portable-app variables inherited from another application
// would make the started Kamapathy record that application as its launcher.
export function launchEnvironment(env) {
  const environment = { ...env };
  for (const name of [
    "ELECTRON_RUN_AS_NODE",
    "APPIMAGE",
    "APPDIR",
    "ARGV0",
    "OWD",
    "PORTABLE_EXECUTABLE_FILE",
    "PORTABLE_EXECUTABLE_DIR",
    "PORTABLE_EXECUTABLE_APP_FILENAME",
  ])
    delete environment[name];
  return environment;
}

function run(command, args, env, wait) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      detached: !wait,
      stdio: "ignore",
      env: launchEnvironment(env),
    });
    child.once("error", (error) =>
      reject(new Error(`Could not start Kamapathy (${error.code || "failed"}). Open Kamapathy, then retry.`)),
    );
    if (wait)
      child.once("exit", (code) =>
        code === 0
          ? resolvePromise()
          : reject(new Error("Kamapathy is not installed or could not open. Start Kamapathy, then retry.")),
      );
    else
      child.once("spawn", () => {
        child.unref();
        resolvePromise();
      });
  });
}

// Every component of the program's real path must belong to root or this
// account and must not be writable by other accounts, so no one else could have
// placed the program there. Group write is accepted only for root's group,
// macOS's admin group (/Applications), and a Linux user's own group.
// Returns the resolved program path to run, or null. Running the resolved path
// means a link swapped after this check cannot redirect the start.
async function trustedProgram(path) {
  let resolved;
  try {
    resolved = await realpath(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (process.platform === "win32") return resolved;
  if (!(await lstat(resolved)).isFile()) return null;
  let current = resolved;
  for (;;) {
    const metadata = await lstat(current);
    const owner = metadata.uid === 0 || metadata.uid === process.getuid();
    const othersWrite =
      (metadata.mode & 0o002) !== 0 &&
      !(metadata.isDirectory() && (metadata.mode & 0o1000) !== 0);
    const groupWrite =
      (metadata.mode & 0o020) !== 0 &&
      metadata.gid !== 0 &&
      !(process.platform === "darwin" && metadata.gid === 80) &&
      !(process.platform === "linux" && metadata.gid === process.getgid());
    if (!owner || othersWrite || groupWrite) return null;
    const parent = dirname(current);
    if (parent === current) return resolved;
    current = parent;
  }
}

// The recorded start command, with its program resolved, or null when there is
// none or its program could have been replaced by another account.
export async function launchRecord(paths) {
  const saved = await readPrivate(paths.launch, 65536);
  if (saved === null) return null;
  let info;
  try {
    info = JSON.parse(saved);
  } catch {
    return null;
  }
  if (
    typeof info?.command !== "string" ||
    !isAbsolute(info.command) ||
    !Array.isArray(info.args) ||
    !info.args.every((argument) => typeof argument === "string")
  )
    return null;
  const command = await trustedProgram(info.command);
  return command ? { command, args: info.args } : null;
}

// Starts the Kamapathy that last ran with this profile, or the installed app.
export async function launchKamapathy(paths, env = process.env, options = {}) {
  const platform = options.platform || process.platform;
  const info = await launchRecord(paths);
  if (info) return run(info.command, info.args, env, false);
  // macOS opens the installed app through LaunchServices, which drops
  // KAMAPATHY_USER_DATA and would start the default profile instead.
  if (platform === "darwin" && env.KAMAPATHY_USER_DATA) {
    // A recorded program that still exists was refused by the ownership check.
    let refused = false;
    try {
      const command = JSON.parse((await readPrivate(paths.launch, 65536)) ?? "{}").command;
      refused = typeof command === "string" && (await exists(command));
    } catch {}
    throw new Error(
      refused
        ? "Kamapathy's recorded program is in a folder other accounts can change. Open Kamapathy with KAMAPATHY_USER_DATA set yourself, then retry."
        : "Kamapathy has not started with this profile yet. Start Kamapathy with KAMAPATHY_USER_DATA set to it once, then retry.",
    );
  }
  if (platform === "darwin")
    return run("/usr/bin/open", ["-b", "app.kamapathy.browser"], env, true);
  if (platform === "win32") {
    const home = env.USERPROFILE || homedir();
    const executable = join(
      env.LOCALAPPDATA || join(home, "AppData", "Local"),
      "Programs",
      "Kamapathy",
      "Kamapathy.exe",
    );
    if (!(await exists(executable)))
      throw new Error("Kamapathy is not installed. Start Kamapathy, then retry.");
    return run(executable, [], env, false);
  }
  return run("kamapathy", [], env, false);
}

async function agentAccessOff(paths) {
  return exists(paths.off);
}

// Finds Kamapathy's socket for this profile, starting Kamapathy when agent access was
// left on. There is no token: the socket is reachable only by this account,
// and Kamapathy proves it is the server that published the endpoint.
export async function resolveSocket(env = process.env, options = {}) {
  const paths = agentPaths(env);
  const discover = async () => {
    if (!(await exists(paths.directory))) return null;
    await privateDirectory(paths.directory);
    const recorded = await readPrivate(paths.endpoint, 4096);
    if (recorded === null) return null;
    let endpoint;
    try {
      endpoint = JSON.parse(recorded);
    } catch {
      return null;
    }
    if (typeof endpoint?.instance !== "string" || !/^[a-f0-9]{32}$/.test(endpoint.instance))
      return null;
    const connection = {
      socket: checkSocket(endpoint.socket, paths),
      instance: endpoint.instance,
    };
    if (process.platform !== "win32") {
      try {
        await privateDirectory(dirname(connection.socket));
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    }
    return (await answers(connection, options.healthTimeoutMs)) ? connection : null;
  };
  const found = await discover();
  if (found) return found;
  if (await agentAccessOff(paths))
    throw new Error("Agent access is turned off in Kamapathy. Turn it on in Settings, under Agents, then retry.");
  if (env.KAMAPATHY_NO_LAUNCH === "1")
    throw new Error("Kamapathy is not running. Start Kamapathy, then retry.");
  await (options.launch || launchKamapathy)(paths, env);
  const timeout = options.timeoutMs ?? 30000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await sleep(options.intervalMs ?? 250);
    const socket = await discover();
    if (socket) return socket;
    if (await agentAccessOff(paths))
      throw new Error("Agent access is turned off in Kamapathy. Turn it on in Settings, under Agents, then retry.");
  }
  throw new Error(
    `Kamapathy did not accept agents within ${Math.round(timeout / 1000)} seconds. Open Kamapathy and check Recent activity in Settings, then retry.`,
  );
}

// fetch cannot reach a Unix socket or named pipe, so requests go through
// node:http and come back as a standard Response. Each call gets its own
// keep-alive connection, closed afterwards: nothing is reused across a Kamapathy
// restart, and Kamapathy can answer early without cutting off the request.
export function socketFetch(connection) {
  const { socket, instance } = connection;
  return (url, options = {}) =>
    new Promise((resolvePromise, reject) => {
      const agent = new Agent({ keepAlive: true, maxSockets: 1 });
      let settled = false;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        agent.destroy();
        callback(value);
      };
      const target = new URL(url, "http://kamapathy.invalid");
      const body = options.body;
      const request = httpRequest(
        {
          socketPath: socket,
          path: `${target.pathname}${target.search}`,
          agent,
          method: options.method || "GET",
          headers: {
            Host: "kamapathy",
            ...options.headers,
            ...(body !== undefined ? { "Content-Length": Buffer.byteLength(body) } : {}),
          },
          signal: options.signal,
        },
        (response) => {
          if (instance && response.headers["x-kamapathy-instance"] !== instance) {
            response.resume();
            settle(
              reject,
              new IdentityError("Another program answered at Kamapathy's socket. Restart Kamapathy, then retry."),
            );
            return;
          }
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.once("error", (error) => settle(reject, error));
          response.once("end", () => {
            const headers = new Headers();
            for (const [name, value] of Object.entries(response.headers))
              for (const item of [].concat(value ?? [])) headers.append(name, item);
            const status = response.statusCode;
            settle(
              resolvePromise,
              new Response([204, 304].includes(status) ? null : Buffer.concat(chunks), {
                status,
                headers,
              }),
            );
          });
        },
      );
      request.once("error", (error) => settle(reject, error));
      request.end(body);
    });
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

export function uploadRef(value) {
  if (!/^@e[1-9]\d*$/.test(value || ""))
    throw new Error("Upload requires a current file input ref from a snapshot.");
  return value;
}

// Reads 1 to 8 regular files for an upload body: basenames, MIME types and
// base64 bytes. Errors never disclose the local paths.
export async function readUploadFiles(paths) {
  if (paths.length < 1 || paths.length > 8)
    throw new Error("Upload requires between 1 and 8 selected file paths.");
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf", ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json", ".zip": "application/zip", ".aab": "application/octet-stream", ".apk": "application/vnd.android.package-archive" };
  const files = [];
  let total = 0;
  for (const path of paths) {
    let file;
    try {
      file = await open(resolve(path), constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 16 * 1024 * 1024 - total)
        throw new Error("Select regular files totaling at most 16 MiB.");
      // Read a bounded allocation even if another process grows the file.
      const bytes = Buffer.alloc(stat.size + 1);
      let length = 0;
      while (length < bytes.length) {
        const { bytesRead } = await file.read(bytes, length, bytes.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length !== stat.size)
        throw new Error("A selected file changed size while being read. Inspect it before retrying.");
      total += length;
      files.push({ name: basename(path), type: mime[extname(path).toLowerCase()] || "application/octet-stream", data: bytes.subarray(0, length).toString("base64") });
    } catch (error) {
      if (typeof error?.code === "string")
        throw new Error("Could not read a selected file. Check that it is readable, regular, and not a symbolic link.");
      throw error;
    } finally {
      await file?.close();
    }
  }
  return files;
}

// Runs an agent's script in this Node process with a connected client as
// globals. The script reaches pages only through the API's documented routes.
async function runScript(args, options) {
  const stderr = options.stderr || process.stderr;
  let source;
  let file;
  if (args[0] === "-e") source = required(args[1], "script code");
  else if (args[0] === "-") source = await readInput(options.stdin || process.stdin);
  else {
    file = resolve(required(args[0], "script file"));
    if (!(await exists(file)))
      throw new Error("Script file not found. Use run <file.mjs>, run - or run -e <code>.");
  }
  const { connect } = await import("./api.mjs");
  const client = await connect({
    env: options.env,
    connect: options.connect,
    fetch: options.fetch,
  });
  Object.assign(globalThis, {
    kamapathy: client,
    createSpace: (name, choices) => client.createSpace(name, choices),
    space: (id) => client.space(id),
    spaces: () => client.spaces(),
  });
  let temporary;
  try {
    if (source !== undefined) {
      temporary = join(tmpdir(), `kamapathy-run-${randomBytes(8).toString("hex")}.mjs`);
      await writeFile(temporary, source, { mode: 0o600, flag: "wx" });
      file = temporary;
    }
    await import(pathToFileURL(file).href);
    return 0;
  } catch (error) {
    const code = typeof error?.code === "string" ? `${error.code}: ` : "";
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`error: ${code}${printable(message)}\n`);
    return 1;
  } finally {
    if (temporary) await rm(temporary, { force: true });
  }
}

const STATES = {
  checked: { true: "[checked]", false: "[unchecked]", mixed: "[mixed]" },
  selected: { true: "[selected]" },
  expanded: { true: "[expanded]", false: "[collapsed]" },
  pressed: { true: "[pressed]", false: "[not pressed]", mixed: "[partly pressed]" },
};
// State, value and group question after a control's label, for example
// [checked] value="Kamapathy" group "Does your app target children?".
function controlDetails(control) {
  const details = [];
  if (control.disabled) details.push("[disabled]");
  for (const [name, words] of Object.entries(STATES))
    if (Object.hasOwn(words, String(control[name])))
      details.push(words[String(control[name])]);
  if (control.valueHidden) details.push("(value hidden)");
  else if (control.value)
    details.push(
      `value=${JSON.stringify(printable(control.value))}${control.valueTruncated ? " (truncated)" : ""}`,
    );
  if (control.group) details.push(`group ${JSON.stringify(line(control.group))}`);
  return details.map((detail) => ` ${detail}`).join("");
}

export function formatSnapshot(snapshot) {
  const lines = [line(snapshot.title) || "Untitled page", line(snapshot.url)];
  if (snapshot.text) lines.push("", printable(snapshot.text).trim());
  if (snapshot.interactables?.length) {
    lines.push("", "Controls:");
    for (const control of snapshot.interactables) {
      lines.push(
        `${line(control.ref || control.selector)} ${line(control.role || control.tag)} ${JSON.stringify(line(control.label))}${controlDetails(control)}`,
      );
      if (control.type === "file")
        lines.push(`  file upload: ${control.multiple ? "multiple" : "single"}${control.accept ? `; accepts ${line(control.accept)}` : ""}${control.hidden ? "; hidden input in visible form" : ""}`);
      for (const option of control.options || [])
        lines.push(
          `  ${JSON.stringify(line(option.value))}: ${JSON.stringify(line(option.label))}${option.disabled ? " [disabled]" : ""}${option.selected ? " [selected]" : ""}`,
        );
      if (control.optionsTruncated)
        lines.push(
          "  More options omitted. Scope the select or inspect it in Kamapathy.",
        );
    }
  }
  if (snapshot.omittedControls > 0)
    lines.push(
      ...(snapshot.interactables?.length ? [] : [""]),
      `${Number(snapshot.omittedControls)} more controls not listed. Scope with --selector to list them.`,
    );
  if (snapshot.truncated)
    lines.push(
      "",
      "Truncated. Scope with --selector or request --full if needed.",
    );
  return lines.join("\n");
}

// What an action did beyond succeeding, such as which panel scrolled.
function actionSummary(data) {
  const notes = [];
  if (data.drag)
    notes.push(
      data.drag === "html5" ? "dragged with HTML drag and drop" : "dragged with the mouse",
    );
  if (data.fallback === "dom_click")
    notes.push("clicked in the page because the control has no size");
  if (data.scrolled) {
    const where = data.scrolled === "element" ? `panel ${line(data.selector)}` : "page";
    notes.push(
      data.moved === false
        ? `${where} did not move`
        : `scrolled ${where} to ${Number(data.x)},${Number(data.y)}`,
    );
  }
  if (Array.isArray(data.rebound) && data.rebound.length)
    notes.push(
      data.rebound.length === 1
        ? `${line(data.rebound[0])} now points to the redrawn control`
        : `${data.rebound.map(line).join(", ")} now point to the redrawn controls`,
    );
  return notes.length ? `ok: ${notes.join("; ")}` : "ok";
}

// Older Kamapathy versions return spaces without signIns; nothing is added then.
const signIns = (space) =>
  space.signIns === "separate"
    ? " isolated"
    : space.signIns === "shared"
      ? " shared"
      : "";

export function formatResult(data) {
  if (data && "interactables" in data && "url" in data)
    return formatSnapshot(data);
  if (data?.space)
    return `space ${data.space.id} ${JSON.stringify(line(data.space.name))} ${line(data.space.owner)}${signIns(data.space)}`;
  if (data?.tab) return `tab ${data.tab.id} ${line(data.tab.url)}`;
  if (data?.spaces)
    return data.spaces.length
      ? data.spaces
          .map(
            (space) =>
              `${space.id} ${JSON.stringify(line(space.name))} ${line(space.owner)}${signIns(space)}`,
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
            : ` ${actionSummary(payload || {})}`;
      return `${index + 1}. ${line(name)}${detail}`;
    });
    if (data.ok === false)
      output.push(
        `Stopped at action ${Number(data.failedIndex) + 1}: ${line(data.error?.message || data.error || "failed")}`,
      );
    return output.join("\n");
  }
  if (data?.status)
    return `${line(data.status)}${data.version ? ` Kamapathy ${line(data.version)}` : ""}`;
  if (data?.ok)
    return data.owner === "human"
      ? "ok: human control, automation paused"
      : data.owner === "agent"
        ? "ok: agent control resumed"
        : actionSummary(data);
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
        const isolated = args.includes("--isolated");
        body = {
          name: required(
            args.slice(1).find((argument) => argument !== "--isolated"),
            "space name",
          ),
          ...(isolated ? { isolated: true } : {}),
        };
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
    case "upload":
      path = `/tabs/${identifier(args[0])}/upload`;
      method = "POST";
      body = { ref: uploadRef(args[1]), files: await readUploadFiles(args.slice(2)) };
      break;
    case "press":
      path = `/tabs/${identifier(args[0])}/press`;
      method = "POST";
      body = {
        key: required(args[1], "key"),
        ...(args[2] ? target(args[2]) : {}),
      };
      break;
    case "scroll": {
      path = `/tabs/${identifier(args[0])}/scroll`;
      method = "POST";
      // Pixels come before the optional target; a target alone is also fine.
      // No CSS selector starts with a digit, a sign, or a dot before a digit,
      // so those are pixels. A class selector such as .panel is a target.
      const pixels = /^[-+]?\.?\d/.test(args[2] || "");
      const scrolled = pixels ? args[3] : args[2];
      if (args.length > (pixels ? 4 : 3))
        throw new Error("Use scroll <tab-id> <direction> [pixels] [ref-or-selector].");
      body = {
        direction: required(args[1], "direction"),
        ...(pixels ? { pixels: integer(args[2], "pixels", 1) } : {}),
        ...(scrolled ? target(scrolled) : {}),
      };
      break;
    }
    case "drag":
      if (args.length > 3)
        throw new Error("Use drag <tab-id> <source> <target>.");
      path = `/tabs/${identifier(args[0])}/drag`;
      method = "POST";
      body = {
        source: target(required(args[1], "drag source")),
        target: target(required(args[2], "drag target")),
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
    case "resume":
      path = `/spaces/${identifier(args[0])}/resume`;
      method = "POST";
      body = {};
      break;
    case "run":
      return runScript(args, options);
    default:
      throw new Error(`Unknown command: ${command}. Run help for usage.`);
  }
  const encoded = body === undefined ? undefined : JSON.stringify(body);
  if (encoded && Buffer.byteLength(encoded) > (command === "upload" ? 24 * 1024 * 1024 : 65536))
    throw new Error(
      "Encoded request exceeds 64 KiB. Split the batch or reduce field values.",
    );
  const send =
    options.fetch ||
    socketFetch(await resolveSocket(options.env || process.env, options.connect));
  const response = await send(new URL(path, "http://kamapathy.invalid"), {
    method,
    headers: encoded ? { "Content-Type": "application/json" } : {},
    body: encoded,
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
    if (error?.name === "TimeoutError" || error?.name === "AbortError")
      message =
        "Request timed out. Inspect the page before retrying an action that may have submitted a form.";
    (options.stderr || process.stderr).write(`Kamapathy: ${printable(message)}\n`);
    return 1;
  }
}

// No top level await here: run imports api.mjs, which imports this module, and
// an await pending in this module would leave that import waiting forever.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().then((code) => {
    process.exitCode = code;
  });
