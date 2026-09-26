import { randomBytes } from "node:crypto";
import { chmodSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { WebContents } from "electron";
import type { BrowserAction, BrowserState, Space } from "../shared/types";
import { isWebUrl } from "../shared/url";
import {
  pageOperation,
  type PageOperation,
  type SnapshotOptions,
} from "./automation-dom";

export interface AutomationController {
  readonly state: BrowserState;
  dispatch(action: BrowserAction): Promise<BrowserState>;
  createAgentSpace(name: string): Space;
  getWebContents(tabId: string): WebContents | undefined;
  canCapturePage(): boolean;
  addActivity(
    spaceId: string | undefined,
    message: string,
    kind: "info" | "success" | "warning",
  ): void;
}
export interface AutomationServer {
  /** The socket path, or named pipe on Windows, that agents connect to. */
  endpoint: string;
  /** Random per start; returned on every response so clients can verify it. */
  instance: string;
  grantSpace(id: string): void;
  close(): Promise<void>;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, code, message);
};
const BODY_LIMIT = 65536;
const UPLOAD_BODY_LIMIT = 24 * 1024 * 1024;
const UPLOAD_FILE_LIMIT = 16 * 1024 * 1024;
const WORLD_ID = 1001;
// API restarts in the same app process must not recycle an old element ref.
let nextElementReference = 1;
const PRESS_KEYS: Record<
  string,
  { key: string; code: string; keyCode: number; text?: string }
> = {
  Enter: { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
  Tab: { key: "Tab", code: "Tab", keyCode: 9 },
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
  Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
  Delete: { key: "Delete", code: "Delete", keyCode: 46 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  Home: { key: "Home", code: "Home", keyCode: 36 },
  End: { key: "End", code: "End", keyCode: 35 },
  PageUp: { key: "PageUp", code: "PageUp", keyCode: 33 },
  PageDown: { key: "PageDown", code: "PageDown", keyCode: 34 },
  Space: { key: " ", code: "Space", keyCode: 32, text: " " },
};
type ToolAction = {
  type: "snapshot" | "click" | "fill" | "press" | "scroll" | "drag" | "wait";
  payload: Record<string, unknown>;
};
type Point = { x: number; y: number };

function integerField(
  body: Record<string, unknown>,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = body[name] === undefined ? fallback : body[name];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  )
    return fail(
      400,
      "invalid_field",
      `${name} must be an integer from ${minimum} to ${maximum}.`,
    );
  return value;
}
function targetFields(
  body: Record<string, unknown>,
  optional = false,
): Record<string, unknown> {
  const hasRef = body.ref !== undefined,
    hasSelector = body.selector !== undefined;
  if (!hasRef && !hasSelector && optional) return {};
  if (hasRef === hasSelector)
    return fail(
      400,
      "invalid_target",
      "Provide exactly one of ref or selector.",
    );
  if (hasRef) {
    const ref = stringField(body, "ref", 32);
    if (!/^@e[1-9]\d*$/.test(ref))
      return fail(
        400,
        "invalid_ref",
        "Use an element reference from a snapshot, such as @e1.",
      );
    return { ref };
  }
  return { selector: stringField(body, "selector", 2048) };
}
function parseToolAction(
  type: string,
  body: Record<string, unknown>,
): ToolAction {
  if (type === "snapshot") {
    const mode = body.mode ?? "compact";
    if (mode !== "compact" && mode !== "full")
      return fail(400, "invalid_field", "mode must be compact or full.");
    const options: Omit<SnapshotOptions, "firstRef"> = {
      mode,
      maxChars: integerField(
        body,
        "maxChars",
        mode === "compact" ? 4000 : 24000,
        0,
        24000,
      ),
      maxControls: integerField(
        body,
        "maxControls",
        mode === "compact" ? 40 : 100,
        0,
        100,
      ),
      ...(body.selector !== undefined
        ? { selector: stringField(body, "selector", 2048) }
        : {}),
    };
    return { type, payload: options };
  }
  if (type === "click" || type === "fill")
    return {
      type,
      payload: {
        ...targetFields(body),
        ...(type === "fill"
          ? { value: stringField(body, "value", 16384, true) }
          : {}),
      },
    };
  if (type === "press") {
    const key = stringField(body, "key", 20);
    if (!Object.hasOwn(PRESS_KEYS, key))
      return fail(
        400,
        "invalid_key",
        `Supported keys: ${Object.keys(PRESS_KEYS).join(", ")}.`,
      );
    return { type, payload: { key, ...targetFields(body, true) } };
  }
  if (type === "scroll") {
    const direction = stringField(body, "direction", 5);
    if (!["up", "down", "left", "right"].includes(direction))
      return fail(
        400,
        "invalid_field",
        "direction must be up, down, left, or right.",
      );
    return {
      type,
      payload: {
        direction,
        pixels: integerField(body, "pixels", 600, 1, 2000),
        ...targetFields(body, true),
      },
    };
  }
  if (type === "drag") {
    const endpoint = (name: "source" | "target") => {
      const value = body[name];
      if (!value || typeof value !== "object" || Array.isArray(value))
        return fail(
          400,
          "invalid_target",
          `${name} must be an object with a ref or selector.`,
        );
      return targetFields(value as Record<string, unknown>);
    };
    return {
      type,
      payload: { source: endpoint("source"), target: endpoint("target") },
    };
  }
  if (type === "wait")
    return {
      type,
      payload: {
        timeoutMs: integerField(body, "timeoutMs", 5000, 0, 15000),
        ...(body.selector !== undefined
          ? { selector: stringField(body, "selector", 2048) }
          : {}),
        ...(body.text !== undefined
          ? { text: stringField(body, "text", 1000) }
          : {}),
      },
    };
  return fail(
    400,
    "invalid_action",
    "Batch actions support snapshot, click, fill, press, scroll, drag, and wait.",
  );
}

const finitePoint = (point: unknown): point is Point =>
  !!point &&
  Number.isFinite((point as Point).x) &&
  Number.isFinite((point as Point).y);
// Refs the page moved to a control it drew again, as the page reported them.
const reboundOf = (result: Record<string, unknown>) =>
  Array.isArray(result.rebound) ? { rebound: result.rebound } : {};

function send(response: ServerResponse, status: number, data: unknown) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function readBody(
  request: IncomingMessage,
  limit = BODY_LIMIT,
): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] || "")
  )
    return fail(415, "content_type", "Use Content-Type: application/json.");
  const sizeError = `Request body exceeds ${limit / 1024} KiB.`;
  if (Number(request.headers["content-length"] || 0) > limit)
    return fail(413, "body_too_large", sizeError);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: ApiError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        request.resume();
        reject(error);
        return;
      }
      try {
        const body: unknown = JSON.parse(
          Buffer.concat(chunks).toString("utf8"),
        );
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw new Error("Invalid body");
        resolve(body as Record<string, unknown>);
      } catch {
        reject(
          new ApiError(400, "invalid_json", "Body must be a JSON object."),
        );
      }
    };
    const timer = setTimeout(
      () =>
        finish(new ApiError(408, "body_timeout", "Request body timed out.")),
      5000,
    );
    request.on("data", (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit)
        finish(
          new ApiError(413, "body_too_large", sizeError),
        );
      else chunks.push(chunk);
    });
    request.once("end", () => finish());
    request.once("error", () =>
      finish(new ApiError(400, "invalid_body", "Could not read request body.")),
    );
    request.once("aborted", () =>
      finish(new ApiError(400, "invalid_body", "Request was interrupted.")),
    );
  });
}

function stringField(
  body: Record<string, unknown>,
  key: string,
  max: number,
  empty = false,
): string {
  const value = body[key];
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.length > max
  )
    return fail(
      400,
      "invalid_field",
      `${key} must be ${empty ? "a" : "a nonempty"} string of at most ${max} characters.`,
    );
  return value;
}
function urlField(body: Record<string, unknown>): string {
  const value = stringField(body, "url", 8192);
  if (!isWebUrl(value))
    return fail(
      400,
      "invalid_url",
      "Use a complete HTTP or HTTPS URL without embedded credentials.",
    );
  return new URL(value).href;
}
function uploadFields(body: Record<string, unknown>) {
  const target = targetFields(body);
  if (!target.ref)
    return fail(400, "invalid_target", "Uploads require a current file input ref from a snapshot.");
  if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 8)
    return fail(400, "invalid_files", "Provide between 1 and 8 files.");
  let total = 0;
  const files = body.files.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return fail(400, "invalid_files", "Each file needs a name, MIME type, and base64 content.");
    const file = entry as Record<string, unknown>;
    const name = stringField(file, "name", 255);
    if (/[\\/\u0000-\u001f\u007f]/.test(name) || name === "." || name === "..")
      return fail(400, "invalid_files", "File names must be basenames without control characters.");
    const type = stringField(file, "type", 128, true);
    if (type && !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(type))
      return fail(400, "invalid_files", "Use a valid MIME type or an empty string.");
    const data = stringField(file, "data", Math.ceil(UPLOAD_FILE_LIMIT / 3) * 4, true);
    if (data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(data) || !/^[A-Za-z0-9+/]*={0,2}$/.test(data))
      return fail(400, "invalid_files", "File content must be canonical base64.");
    const decoded = Buffer.from(data, "base64");
    if (decoded.toString("base64") !== data)
      return fail(400, "invalid_files", "File content must be canonical base64.");
    total += decoded.length;
    if (total > UPLOAD_FILE_LIMIT)
      return fail(413, "files_too_large", "Files must total at most 16 MiB per upload.");
    return { name, type, data };
  });
  return { ...target, files };
}
async function bounded<T>(operation: Promise<T>, timeout = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ApiError(
                504,
                "page_timeout",
                "The page did not respond in time.",
              ),
            ),
          timeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// The API listens only on a Unix socket or Windows named pipe. Browsers cannot
// open either, and the operating system limits them to this account, so the
// connection needs no token.
export async function startAutomation(
  controller: AutomationController,
  options: { socketPath: string },
): Promise<AutomationServer> {
  const instance = randomBytes(16).toString("hex");
  const managedSpaces = new Set<string>();
  let stopped = false;
  let pending = 0;
  let uploading = false;
  let queue: Promise<unknown> = Promise.resolve();
  const referenceSession = randomBytes(12).toString("hex");
  const trackedContents = new Map<
    WebContents,
    {
      epoch: number;
      listener: (
        event: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>,
      ) => void;
      destroyed: () => void;
    }
  >();
  const trackContents = (contents: WebContents) => {
    let tracked = trackedContents.get(contents);
    if (!tracked) {
      tracked = {
        epoch: 0,
        listener: (details) => {
          if (details.isMainFrame && !details.isSameDocument) tracked!.epoch++;
        },
        destroyed: () => trackedContents.delete(contents),
      };
      trackedContents.set(contents, tracked);
      contents.on("did-start-navigation", tracked.listener);
      contents.once("destroyed", tracked.destroyed);
    }
    return tracked;
  };
  // Taking control back is the one request allowed while the person has it.
  const authorizeSpace = (id: string, resuming = false): Space => {
    const space = controller.state.spaces.find((item) => item.id === id);
    if (!space || !managedSpaces.has(id) || space.kind !== "agent")
      return fail(404, "space_not_found", "Agent space was not found.");
    if (space.owner !== "agent" && !resuming)
      return fail(
        409,
        "human_control",
        `The person is using this space. Wait for them. If they tell you they are done or ask you to continue, take control back with resume ${space.id}.`,
      );
    if (stopped)
      return fail(503, "automation_stopped", "Automation is disabled.");
    return space;
  };
  const authorizeTab = (id: string) => {
    const tab = controller.state.tabs.find((item) => item.id === id);
    if (!tab || !managedSpaces.has(tab.spaceId))
      return fail(404, "tab_not_found", "Agent tab was not found.");
    authorizeSpace(tab.spaceId);
    return tab;
  };
  const readyContents = async (
    id: string,
    timeout = 15000,
    allowLoading = false,
  ) => {
    authorizeTab(id);
    const contents = controller.getWebContents(id);
    if (!contents || contents.isDestroyed())
      return fail(
        409,
        "no_web_page",
        "Navigate this tab to an HTTP or HTTPS page first.",
      );
    trackContents(contents);
    if (!allowLoading && contents.isLoadingMainFrame()) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          contents.removeListener("did-stop-loading", loaded);
          contents.removeListener("destroyed", destroyed);
        };
        const loaded = () => {
          cleanup();
          resolve();
        };
        const destroyed = () => {
          cleanup();
          reject(new ApiError(409, "tab_closed", "The tab was closed."));
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(
            new ApiError(
              504,
              "page_timeout",
              "The page is still loading. Try again.",
            ),
          );
        }, timeout);
        contents.once("did-stop-loading", loaded);
        contents.once("destroyed", destroyed);
      });
    }
    authorizeTab(id);
    if (contents.isDestroyed())
      return fail(409, "tab_closed", "The tab was closed.");
    return contents;
  };

  const remaining = (deadline: number) => {
    const milliseconds = deadline - Date.now();
    if (milliseconds <= 0)
      return fail(
        504,
        "action_timeout",
        "The action time budget expired. Inspect the page before retrying a side effect.",
      );
    return Math.min(15000, milliseconds);
  };
  const evaluatePage = async (
    id: string,
    contents: WebContents,
    operation: PageOperation,
    payload: Record<string, unknown>,
    deadline: number,
  ) => {
    authorizeTab(id);
    const epoch = trackContents(contents).epoch;
    const namespace = `${referenceSession}:${id}:${epoch}`;
    const result = (await bounded(
      contents.executeJavaScriptInIsolatedWorld(WORLD_ID, [
        {
          code: `(${pageOperation.toString()})(${JSON.stringify(operation)},${JSON.stringify(payload)},${JSON.stringify(namespace)})`,
        },
      ]),
      remaining(deadline),
    )) as Record<string, unknown>;
    authorizeTab(id);
    if (
      ["snapshot", "target", "focus", "drag"].includes(operation) &&
      trackContents(contents).epoch !== epoch
    )
      return fail(
        409,
        "page_changed",
        "The page navigated during this operation. Inspect the new page before continuing.",
      );
    if (result?.ok === false)
      return fail(
        422,
        typeof result.code === "string" ? result.code : "element_action_failed",
        typeof result.error === "string"
          ? result.error
          : "Could not interact with the element.",
      );
    return result;
  };
  const nativeInput = async (
    id: string,
    contents: WebContents,
    commands: {
      method: "Input.dispatchMouseEvent" | "Input.dispatchKeyEvent";
      parameters: Record<string, unknown>;
    }[],
    deadline: number,
    epoch: number,
  ) => {
    authorizeTab(id);
    if (contents.debugger.isAttached())
      return fail(
        409,
        "debugger_busy",
        "Close this tab's developer tools before using native agent input.",
      );
    contents.debugger.attach("1.3");
    try {
      for (const command of commands) {
        authorizeTab(id);
        if (
          !["mouseReleased", "keyUp"].includes(
            command.parameters.type as string,
          ) &&
          trackContents(contents).epoch !== epoch
        )
          return fail(
            409,
            "page_changed",
            "The page navigated before input completed. Inspect the new page before continuing.",
          );
        await bounded(
          contents.debugger.sendCommand(command.method, command.parameters),
          remaining(deadline),
        );
      }
    } finally {
      if (!contents.isDestroyed() && contents.debugger.isAttached())
        contents.debugger.detach();
    }
    authorizeTab(id);
  };
  // Presses on the source, moves past the distance pages wait for before a
  // drag starts (4 pixels in Chromium, 5 to 8 in pointer libraries), then on to
  // the target in steps. An HTML drag the page starts is intercepted, so no
  // operating system drag begins, and is moved with drag events instead.
  const nativeDrag = async (
    id: string,
    contents: WebContents,
    from: Point,
    to: Point,
    armed: Record<string, unknown>,
    deadline: number,
    epoch: number,
  ): Promise<"html5" | "mouse"> => {
    authorizeTab(id);
    if (contents.debugger.isAttached())
      return fail(
        409,
        "debugger_busy",
        "Close this tab's developer tools before using native agent input.",
      );
    contents.debugger.attach("1.3");
    let data: unknown;
    let intercepted = () => {};
    const listener = (
      _event: Electron.Event,
      method: string,
      parameters: { data?: unknown },
    ) => {
      if (method !== "Input.dragIntercepted") return;
      data = parameters.data;
      intercepted();
    };
    contents.debugger.on("message", listener);
    let dragging = false;
    let dropped = false;
    let last = from;
    // The final release or drop is still sent after a navigation starts.
    const send = async (
      method: string,
      parameters: Record<string, unknown>,
      final = false,
    ) => {
      authorizeTab(id);
      if (!final && trackContents(contents).epoch !== epoch)
        return fail(
          409,
          "page_changed",
          "The page navigated before input completed. Inspect the new page before continuing.",
        );
      await bounded(
        contents.debugger.sendCommand(method, parameters),
        remaining(deadline),
      );
    };
    const mouse = (type: string, point: Point, buttons: number, final = false) =>
      send(
        "Input.dispatchMouseEvent",
        {
          type,
          x: point.x,
          y: point.y,
          button: type === "mouseMoved" && !buttons ? "none" : "left",
          buttons,
          ...(type === "mouseMoved" ? {} : { clickCount: 1 }),
        },
        final,
      );
    const drag = (type: string, point: Point, final = false) =>
      send("Input.dispatchDragEvent", { type, x: point.x, y: point.y, data }, final);
    const pause = () => new Promise((resolve) => setTimeout(resolve, 16));
    try {
      try {
        await contents.debugger.sendCommand("Input.setInterceptDrags", {
          enabled: true,
        });
      } catch {
        return fail(
          409,
          "drag_unavailable",
          "Kamapathy could not take over drags in this tab.",
        );
      }
      const dx = to.x - from.x,
        dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const start = distance
        ? { x: from.x + (dx / distance) * 10, y: from.y + (dy / distance) * 10 }
        : { x: from.x + 10, y: from.y };
      const path = Array.from({ length: 8 }, (_, step) => ({
        x: start.x + ((to.x - start.x) * (step + 1)) / 8,
        y: start.y + ((to.y - start.y) * (step + 1)) / 8,
      }));
      path.push(to);
      await mouse("mouseMoved", from, 0);
      await mouse("mousePressed", from, 1);
      await mouse("mouseMoved", start, 1);
      last = start;
      // The page decides in its dragstart handlers whether an HTML drag
      // starts. Its data reaches Kamapathy shortly after.
      await evaluatePage(id, contents, "frame", {}, deadline);
      const counts = await evaluatePage(id, contents, "input", {}, deadline);
      if (
        data === undefined &&
        typeof armed.drag === "number" &&
        typeof counts.drag === "number" &&
        counts.drag > armed.drag
      ) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 2000);
          intercepted = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        if (data === undefined) {
          await mouse("mouseReleased", start, 0, true);
          return fail(
            409,
            "drag_not_delivered",
            "The page started a drag that Kamapathy could not move. Inspect the page before retrying.",
          );
        }
      }
      if (data !== undefined) {
        dragging = true;
        await drag("dragEnter", start);
      }
      for (const point of path) {
        await pause();
        if (dragging) await drag("dragOver", point);
        else if (data !== undefined) {
          dragging = true;
          await drag("dragEnter", point);
        } else await mouse("mouseMoved", point, 1);
        last = point;
      }
      await pause();
      if (dragging) {
        await drag("drop", to, true);
        dropped = true;
        return "html5";
      }
      await mouse("mouseReleased", to, 0, true);
      return "mouse";
    } finally {
      const attached = () =>
        !contents.isDestroyed() && contents.debugger.isAttached();
      // An intercepted drag holds the tab's mouse until it ends, so it is
      // cancelled even after the person takes over. A mouse release is never
      // sent then: pointer libraries drop on it.
      if (data !== undefined && !dropped && attached())
        await bounded(
          contents.debugger.sendCommand("Input.dispatchDragEvent", {
            type: "dragCancel",
            x: last.x,
            y: last.y,
            data,
          }),
          2000,
        ).catch(() => {});
      if (attached()) {
        await bounded(
          contents.debugger.sendCommand("Input.setInterceptDrags", {
            enabled: false,
          }),
          2000,
        ).catch(() => {});
        if (attached()) contents.debugger.detach();
      }
      contents.debugger.removeListener("message", listener);
    }
  };
  // Chromium reports a successful dispatch for native input that it drops while a
  // page has not rendered a frame since its last navigation. Confirm the page
  // received the input and repeat only input that provably never arrived.
  const deliverNativeInput = async <T>(
    id: string,
    contents: WebContents,
    kind: "mouse" | "key",
    deliver: (armed: Record<string, unknown>) => Promise<T>,
    deadline: number,
    epoch: number,
  ): Promise<T> => {
    for (let attempt = 0; ; attempt += 1) {
      const armed = await evaluatePage(id, contents, "input", {}, deadline);
      const delivered = await deliver(armed);
      // Input that already changed the page was delivered.
      if (trackContents(contents).epoch !== epoch) return delivered;
      const received = await evaluatePage(id, contents, "input", {}, deadline);
      const before = armed[kind];
      const after = received[kind];
      // Repeat input only on positive evidence that the page never received it.
      if (typeof before !== "number" || typeof after !== "number" || after > before)
        return delivered;
      if (attempt >= 2)
        return fail(
          409,
          "input_not_delivered",
          "The page did not accept native input. Inspect the page before retrying.",
        );
      await evaluatePage(
        id,
        contents,
        "frame",
        {},
        Math.min(deadline, Date.now() + 2000),
      ).catch(() => {});
    }
  };
  const executeToolAction = async (
    id: string,
    action: ToolAction,
    deadline = Date.now() + 30000,
  ): Promise<Record<string, unknown>> => {
    const tab = authorizeTab(id);
    const waitDeadline =
      action.type === "wait"
        ? Math.min(deadline, Date.now() + (action.payload.timeoutMs as number))
        : deadline;
    const contents = await readyContents(
      id,
      remaining(deadline),
      action.type === "wait",
    );
    const epoch = trackContents(contents).epoch;
    const payload = action.payload;
    let result: Record<string, unknown>;
    if (action.type === "snapshot") {
      const firstRef = nextElementReference;
      nextElementReference += 100;
      result = {
        tabId: id,
        ...(await evaluatePage(
          id,
          contents,
          "snapshot",
          { ...payload, firstRef },
          deadline,
        )),
      };
    } else if (action.type === "click") {
      const point = await evaluatePage(
        id,
        contents,
        "target",
        payload,
        deadline,
      );
      // A control drawn with no size has no point to press, so the page
      // clicks it, once its surroundings are on screen and uncovered.
      const empty = point.empty === true;
      if (empty) {
        if (trackContents(contents).epoch !== epoch)
          return fail(
            409,
            "page_changed",
            "The page navigated during this operation. Inspect the new page before continuing.",
          );
        await evaluatePage(id, contents, "click", payload, deadline);
      }
      else {
        if (!finitePoint(point))
          return fail(
            422,
            "invalid_target",
            "The page did not provide a valid click target.",
          );
        await deliverNativeInput(
          id,
          contents,
          "mouse",
          () =>
            nativeInput(
              id,
              contents,
              [
                {
                  method: "Input.dispatchMouseEvent",
                  parameters: { type: "mouseMoved", x: point.x, y: point.y },
                },
                {
                  method: "Input.dispatchMouseEvent",
                  parameters: {
                    type: "mousePressed",
                    x: point.x,
                    y: point.y,
                    button: "left",
                    clickCount: 1,
                  },
                },
                {
                  method: "Input.dispatchMouseEvent",
                  parameters: {
                    type: "mouseReleased",
                    x: point.x,
                    y: point.y,
                    button: "left",
                    clickCount: 1,
                  },
                },
              ],
              deadline,
              epoch,
            ),
          deadline,
          epoch,
        );
      }
      // Let synchronous submit/navigation handlers start, then wait for their load.
      // No input operation is retried, including when navigation times out.
      await new Promise((resolve) => setTimeout(resolve, 100));
      await readyContents(id, remaining(deadline));
      result = {
        ok: true,
        url: contents.getURL(),
        ...(empty ? { fallback: "dom_click" } : {}),
        ...reboundOf(point),
      };
    } else if (action.type === "fill") {
      result = await evaluatePage(id, contents, "fill", payload, deadline);
    } else if (action.type === "drag") {
      const points = await evaluatePage(id, contents, "drag", payload, deadline);
      const from = points.from as Point,
        to = points.to as Point;
      if (!finitePoint(from) || !finitePoint(to))
        return fail(
          422,
          "invalid_target",
          "The page did not provide valid drag points.",
        );
      const mode = await deliverNativeInput(
        id,
        contents,
        "mouse",
        (armed) => nativeDrag(id, contents, from, to, armed, deadline, epoch),
        deadline,
        epoch,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      await readyContents(id, remaining(deadline));
      result = {
        ok: true,
        url: contents.getURL(),
        drag: mode,
        ...reboundOf(points),
      };
    } else if (action.type === "press") {
      let focused: Record<string, unknown> = {};
      if (payload.ref || payload.selector)
        focused = await evaluatePage(id, contents, "focus", payload, deadline);
      const key = PRESS_KEYS[payload.key as string];
      const parameters = {
        key: key.key,
        code: key.code,
        windowsVirtualKeyCode: key.keyCode,
        nativeVirtualKeyCode: key.keyCode,
        ...(key.text ? { text: key.text, unmodifiedText: key.text } : {}),
      };
      await deliverNativeInput(
        id,
        contents,
        "key",
        () =>
          nativeInput(
            id,
            contents,
            [
              {
                method: "Input.dispatchKeyEvent",
                parameters: {
                  type: key.text ? "keyDown" : "rawKeyDown",
                  ...parameters,
                },
              },
              {
                method: "Input.dispatchKeyEvent",
                parameters: {
                  type: "keyUp",
                  key: key.key,
                  code: key.code,
                  windowsVirtualKeyCode: key.keyCode,
                  nativeVirtualKeyCode: key.keyCode,
                },
              },
            ],
            deadline,
            epoch,
          ),
        deadline,
        epoch,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      await readyContents(id, remaining(deadline));
      result = { ok: true, url: contents.getURL(), ...reboundOf(focused) };
    } else if (action.type === "scroll") {
      result = await evaluatePage(id, contents, "scroll", payload, deadline);
    } else {
      for (;;) {
        authorizeTab(id);
        let observation: Record<string, unknown>;
        try {
          observation = await evaluatePage(
            id,
            contents,
            "check",
            payload,
            // Zero makes one attempt with a short IPC response allowance.
            payload.timeoutMs === 0
              ? Math.min(deadline, Date.now() + 250)
              : Math.min(deadline, Math.max(Date.now() + 1, waitDeadline)),
          );
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            !["page_timeout", "action_timeout"].includes(error.code) ||
            Date.now() < waitDeadline
          )
            throw error;
          return fail(
            408,
            "wait_timeout",
            "The requested page condition was not observed before the timeout.",
          );
        }
        if (observation.matched) {
          result = { ok: true };
          break;
        }
        if (Date.now() >= waitDeadline)
          return fail(
            408,
            "wait_timeout",
            "The requested page condition was not observed before the timeout.",
          );
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(100, waitDeadline - Date.now())),
        );
        await readyContents(id, remaining(deadline), true);
      }
    }
    authorizeTab(id);
    const descriptions = {
      snapshot: "Agent read a page snapshot",
      click: "Agent clicked an element",
      fill: "Agent filled a field",
      press: "Agent pressed a key",
      scroll: "Agent scrolled a page",
      drag: "Agent dragged an element",
      wait: "Agent observed a page condition",
    };
    controller.addActivity(tab.spaceId, descriptions[action.type], "info");
    return result;
  };

  const route = async (
    request: IncomingMessage,
    response: ServerResponse,
    body?: Record<string, unknown>,
    resumeFromHuman = false,
  ) => {
    if (stopped)
      return fail(503, "automation_stopped", "Automation is disabled.");
    const rawPath = request.url || "/";
    if (!/^\/[a-zA-Z0-9/_-]*$/.test(rawPath))
      return fail(
        400,
        "invalid_path",
        "Use a route without query parameters or encoded path segments.",
      );
    const parts = rawPath.split("/").filter(Boolean);
    const method = request.method;
    if (rawPath === "/spaces" && method === "GET")
      return send(response, 200, {
        spaces: controller.state.spaces.filter(
          (space) => managedSpaces.has(space.id) && space.kind === "agent",
        ),
      });
    if (rawPath === "/spaces" && method === "POST") {
      const name = stringField(body!, "name", 48).trim();
      for (const id of managedSpaces)
        if (!controller.state.spaces.some((space) => space.id === id))
          managedSpaces.delete(id);
      if (managedSpaces.size >= 12)
        return fail(
          409,
          "space_limit",
          "Close an agent space before creating another. The limit is 12.",
        );
      const space = controller.createAgentSpace(name);
      managedSpaces.add(space.id);
      controller.addActivity(
        space.id,
        "Agent connected to an isolated space",
        "success",
      );
      return send(response, 201, { space });
    }
    if (parts[0] === "spaces" && parts.length >= 2) {
      const resuming =
        parts.length === 3 && parts[2] === "resume" && method === "POST";
      const space = authorizeSpace(parts[1], resuming && resumeFromHuman);
      if (resuming) {
        if (space.owner !== "agent") {
          await controller.dispatch({
            type: "space:ownership",
            id: space.id,
            owner: "agent",
          });
          controller.addActivity(
            space.id,
            "Agent took back control of this space",
            "info",
          );
        }
        return send(response, 200, { ok: true, owner: "agent" });
      }
      if (parts.length === 2 && method === "DELETE") {
        await controller.dispatch({ type: "space:delete", id: space.id });
        managedSpaces.delete(space.id);
        return send(response, 200, { ok: true });
      }
      if (parts.length === 3 && parts[2] === "handoff" && method === "POST") {
        await controller.dispatch({
          type: "space:ownership",
          id: space.id,
          owner: "human",
        });
        controller.addActivity(
          space.id,
          "Agent handed this space to you",
          "success",
        );
        return send(response, 200, { ok: true, owner: "human" });
      }
      if (parts.length === 3 && parts[2] === "tabs" && method === "GET")
        return send(response, 200, {
          tabs: controller.state.tabs.filter((tab) => tab.spaceId === space.id),
        });
      if (parts.length === 3 && parts[2] === "tabs" && method === "POST") {
        const url = urlField(body!);
        const before = new Set(controller.state.tabs.map((tab) => tab.id));
        if (
          controller.state.tabs.filter((tab) => tab.spaceId === space.id)
            .length >= 20
        )
          return fail(
            409,
            "tab_limit",
            "Close a tab before creating another. The limit is 20 per agent space.",
          );
        await controller.dispatch({
          type: "tab:create",
          spaceId: space.id,
          url,
          background: true,
        });
        authorizeSpace(space.id);
        const tab = controller.state.tabs.find(
          (item) => item.spaceId === space.id && !before.has(item.id),
        );
        if (!tab)
          return fail(
            500,
            "tab_creation_failed",
            "Could not create an agent tab.",
          );
        controller.addActivity(
          space.id,
          `Agent opened ${new URL(url).hostname}`,
          "info",
        );
        return send(response, 201, { tab });
      }
    }
    if (parts[0] === "tabs" && parts.length >= 2) {
      const tab = authorizeTab(parts[1]);
      if (parts.length === 2 && method === "DELETE") {
        await controller.dispatch({ type: "tab:close", id: tab.id });
        controller.addActivity(tab.spaceId, "Agent closed a tab", "info");
        return send(response, 200, { ok: true });
      }
      if (parts.length === 3 && parts[2] === "navigate" && method === "POST") {
        const url = urlField(body!);
        await controller.dispatch({ type: "tab:navigate", id: tab.id, url });
        const updated = authorizeTab(tab.id);
        controller.addActivity(
          tab.spaceId,
          `Agent navigated to ${new URL(url).hostname}`,
          "info",
        );
        return send(response, 200, { tab: updated });
      }
      if (
        parts.length === 3 &&
        parts[2] === "snapshot" &&
        (method === "GET" || method === "POST")
      ) {
        return send(
          response,
          200,
          await executeToolAction(
            tab.id,
            parseToolAction("snapshot", body || {}),
          ),
        );
      }
      if (parts.length === 3 && parts[2] === "actions" && method === "POST") {
        if (
          !Array.isArray(body!.actions) ||
          body!.actions.length < 1 ||
          body!.actions.length > 20
        )
          return fail(
            400,
            "invalid_actions",
            "actions must contain between 1 and 20 fixed browser actions.",
          );
        // Validate the entire plan before the first side effect.
        const actions = body!.actions.map((value: unknown) => {
          if (!value || typeof value !== "object" || Array.isArray(value))
            return fail(
              400,
              "invalid_action",
              "Each action must be an object with a type.",
            );
          const action = value as Record<string, unknown>;
          return parseToolAction(stringField(action, "type", 20), action);
        });
        const results: {
          index: number;
          type: string;
          result: Record<string, unknown>;
        }[] = [];
        const deadline = Date.now() + 60000;
        for (const [index, action] of actions.entries()) {
          try {
            if (response.destroyed) return;
            authorizeTab(tab.id);
            results.push({
              index,
              type: action.type,
              result: await executeToolAction(tab.id, action, deadline),
            });
          } catch (error) {
            const known = error instanceof ApiError;
            const code = known ? error.code : "operation_failed";
            const withheld = [
              "human_control",
              "automation_stopped",
              "tab_not_found",
              "space_not_found",
            ].includes(code);
            return send(response, known ? error.status : 500, {
              ok: false,
              results: withheld
                ? results.map((entry) => ({
                    ...entry,
                    result: { ok: true, withheld: true },
                  }))
                : results,
              failedIndex: index,
              error: {
                code,
                message: known
                  ? error.message
                  : "The browser could not complete this step. Inspect the page before retrying any side effect.",
              },
            });
          }
        }
        authorizeTab(tab.id);
        return send(response, 200, { ok: true, results });
      }
      if (parts.length === 3 && parts[2] === "screenshot" && method === "GET") {
        const requireCaptureWindow = () => {
          if (!controller.canCapturePage())
            return fail(
              409,
              "screenshot_unavailable",
              "Restore or show the Kamapathy window to capture a screenshot. Snapshots and page actions remain available while it is minimized or hidden.",
            );
        };
        requireCaptureWindow();
        const contents = await readyContents(tab.id);
        requireCaptureWindow();
        const screenshot = await bounded(
          contents.capturePage(undefined, { stayHidden: true }),
        ).catch((error: unknown) => {
          authorizeTab(tab.id);
          requireCaptureWindow();
          if (error instanceof ApiError) throw error;
          return fail(
            503,
            "screenshot_failed",
            "The page could not render a screenshot. Read a snapshot or try again after the page finishes rendering.",
          );
        });
        authorizeTab(tab.id);
        if (screenshot.isEmpty())
          return fail(
            409,
            "empty_screenshot",
            "The page has not rendered yet. Try again.",
          );
        controller.addActivity(
          tab.spaceId,
          "Agent captured a page screenshot",
          "info",
        );
        response.writeHead(200, {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return response.end(screenshot.toPNG());
      }
      if (
        parts.length === 3 &&
        ["click", "fill", "press", "scroll", "drag", "wait"].includes(parts[2]) &&
        method === "POST"
      ) {
        return send(
          response,
          200,
          await executeToolAction(tab.id, parseToolAction(parts[2], body!)),
        );
      }
    }
    return fail(404, "route_not_found", "Automation route was not found.");
  };

  const server = createServer(async (request, response) => {
    response.setHeader("X-Kamapathy-Instance", instance);
    try {
      if (
        request.headers.origin !== undefined ||
        request.headers["sec-fetch-site"] !== undefined
      )
        return fail(
          403,
          "local_clients_only",
          "Only direct local clients may use this API.",
        );
      // Clients check liveness and identity here before every command, so it
      // never waits behind another agent's page actions.
      if (request.method === "GET" && request.url === "/health") {
        if (stopped)
          return fail(503, "automation_stopped", "Automation is disabled.");
        return send(response, 200, {
          status: "ok",
          version: controller.state.version,
        });
      }
      if (pending >= 16)
        return fail(429, "busy", "Too many pending requests. Try again later.");
      pending++;
      let ownsUpload = false;
      try {
        // Only this fixed route accepts a larger body. Reserve one transfer
        // before reading bytes, so concurrent uploads cannot multiply memory.
        const upload = request.method === "POST"
          ? /^\/tabs\/([a-zA-Z0-9_-]{1,128})\/upload$/.exec(request.url || "")
          : null;
        let uploadContents: WebContents | undefined;
        let uploadEpoch: number | undefined;
        if (upload) {
          authorizeTab(upload[1]);
          if (uploading)
            return fail(429, "upload_busy", "Another file transfer is in progress.");
          uploading = ownsUpload = true;
          uploadContents = controller.getWebContents(upload[1]);
          if (!uploadContents || uploadContents.isDestroyed())
            return fail(409, "no_web_page", "Open a web page before uploading files.");
          uploadEpoch = trackContents(uploadContents).epoch;
        }
        // A resume passes human control only if the person had control when
        // it arrived, so a queued one cannot undo a takeover the agent never saw.
        const resumeRoute = request.method === "POST"
          ? /^\/spaces\/([a-zA-Z0-9_-]{1,128})\/resume$/.exec(request.url || "")
          : null;
        const resumeFromHuman = resumeRoute !== null &&
          controller.state.spaces.find((space) => space.id === resumeRoute[1])?.owner === "human";
        const body =
          request.method === "POST" ? await readBody(request, upload ? UPLOAD_BODY_LIMIT : BODY_LIMIT) : undefined;
        const operation = queue.then(() => {
          if (response.destroyed || response.writableEnded) return;
          if (upload) return (async () => {
            authorizeTab(upload[1]);
            if (uploadContents!.isDestroyed() ||
                controller.getWebContents(upload[1]) !== uploadContents ||
                trackContents(uploadContents!).epoch !== uploadEpoch)
              return fail(409, "page_changed", "The page changed during the transfer. Take a fresh snapshot.");
            const payload = uploadFields(body!);
            const result = await evaluatePage(upload[1], uploadContents!, "upload", payload, Date.now() + 30000);
            const tab = authorizeTab(upload[1]);
            controller.addActivity(tab.spaceId, `Agent selected ${payload.files.length} file(s) for upload`, "info");
            return send(response, 200, result);
          })();
          return route(request, response, body, resumeFromHuman);
        });
        queue = operation.catch(() => {});
        await operation;
      } finally {
        if (ownsUpload) uploading = false;
        pending--;
      }
    } catch (error) {
      const known = error instanceof ApiError;
      send(response, known ? error.status : 500, {
        error: {
          code: known ? error.code : "operation_failed",
          message: known
            ? error.message
            : "The browser could not complete this operation. Retry after the page finishes loading.",
        },
      });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 2000;
  server.maxConnections = 32;
  server.maxRequestsPerSocket = 100;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.socketPath, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  // The private directory is the real boundary; the socket itself is also
  // made unreadable to other accounts.
  if (process.platform !== "win32") chmodSync(options.socketPath, 0o600);
  let closing: Promise<void> | undefined;
  return {
    endpoint: options.socketPath,
    instance,
    grantSpace(id: string) {
      const space = controller.state.spaces.find((item) => item.id === id);
      if (stopped || space?.kind !== "agent" || space.owner !== "agent")
        throw new Error("Only an active agent space can be connected.");
      for (const managedId of managedSpaces)
        if (!controller.state.spaces.some((item) => item.id === managedId))
          managedSpaces.delete(managedId);
      if (!managedSpaces.has(id) && managedSpaces.size >= 12)
        throw new Error(
          "Close an agent space before granting another. The limit is 12.",
        );
      managedSpaces.add(id);
    },
    close() {
      if (!closing) {
        stopped = true;
        managedSpaces.clear();
        for (const [contents, tracked] of trackedContents) {
          if (!contents.isDestroyed()) {
            contents.removeListener("did-start-navigation", tracked.listener);
            contents.removeListener("destroyed", tracked.destroyed);
          }
        }
        trackedContents.clear();
        closing = new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        });
      }
      return closing;
    },
  };
}
