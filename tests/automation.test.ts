import { EventEmitter } from "node:events";
import { request as httpRequest } from "node:http";
import type { WebContents } from "electron";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  startAutomation,
  validAuthorization,
  type AutomationController,
  type AutomationServer,
} from "../electron/automation";
import { initialState, newTab } from "../shared/state";
import type { BrowserAction, BrowserState, Space } from "../shared/types";

class FakeContents extends EventEmitter {
  scripts: { worldId: number; code: string }[] = [];
  inputs: { method: string; parameters: Record<string, unknown> }[] = [];
  afterInput?: () => void;
  private attached = false;
  debugger = {
    isAttached: () => this.attached,
    attach: () => {
      this.attached = true;
    },
    detach: () => {
      this.attached = false;
    },
    sendCommand: async (
      method: string,
      parameters: Record<string, unknown>,
    ) => {
      this.inputs.push({ method, parameters });
      this.afterInput?.();
      return {};
    },
  };
  result: unknown = {
    url: "https://example.com/",
    title: "Example",
    text: "Hello from the agent page",
    interactables: [],
    truncated: false,
  };
  isDestroyed() {
    return false;
  }
  isLoadingMainFrame() {
    return false;
  }
  getURL() {
    return "https://example.com/";
  }
  async executeJavaScriptInIsolatedWorld(
    worldId: number,
    scripts: { code: string }[],
  ) {
    this.scripts.push({ worldId, code: scripts[0].code });
    return typeof this.result === "function"
      ? this.result(scripts[0].code)
      : this.result;
  }
  async capturePage() {
    return {
      isEmpty: () => false,
      toPNG: () => Buffer.from([137, 80, 78, 71]),
    };
  }
}
class FakeController implements AutomationController {
  state: BrowserState = initialState("linux");
  contents = new FakeContents();
  calls: BrowserAction[] = [];
  accessedTabs: string[] = [];
  constructor() {
    this.state.spaces.push({
      id: "manual-agent",
      name: "Created by a person",
      color: "purple",
      kind: "agent",
      owner: "agent",
      createdAt: Date.now(),
    });
    this.state.tabs.push(newTab("manual-agent", "https://private.example/"));
  }
  createAgentSpace(name: string): Space {
    const space: Space = {
      id: crypto.randomUUID(),
      name,
      color: "purple",
      kind: "agent",
      owner: "agent",
      createdAt: Date.now(),
    };
    this.state.spaces.push(space);
    this.state.tabs.push(newTab(space.id));
    return space;
  }
  getWebContents(id: string) {
    this.accessedTabs.push(id);
    return this.contents as unknown as WebContents;
  }
  addActivity() {}
  async dispatch(action: BrowserAction) {
    this.calls.push(action);
    if (action.type === "tab:create") {
      const tab = newTab(action.spaceId!, action.url);
      this.state.tabs.push(tab);
      if (!action.background) {
        this.state.activeSpaceId = tab.spaceId;
        this.state.activeTabId = tab.id;
      }
    } else if (action.type === "tab:navigate")
      this.state.tabs.find((tab) => tab.id === action.id)!.url = action.url;
    else if (action.type === "space:ownership")
      this.state.spaces.find((space) => space.id === action.id)!.owner =
        action.owner;
    else if (action.type === "space:delete") {
      this.state.spaces = this.state.spaces.filter(
        (space) => space.id !== action.id,
      );
      this.state.tabs = this.state.tabs.filter(
        (tab) => tab.spaceId !== action.id,
      );
    } else if (action.type === "tab:close")
      this.state.tabs = this.state.tabs.filter((tab) => tab.id !== action.id);
    return this.state;
  }
}

describe("authenticated local automation", () => {
  let controller: FakeController;
  let api: AutomationServer;
  let base: string;
  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${api.token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  const createSpace = async () =>
    (await (await request("/spaces", "POST", { name: "Research" })).json())
      .space as Space;
  const createPage = async () => {
    const space = await createSpace();
    const response = await request(`/spaces/${space.id}/tabs`, "POST", {
      url: "https://example.com/",
    });
    return {
      space,
      tab: (await response.json()).tab as BrowserState["tabs"][number],
    };
  };
  beforeEach(async () => {
    controller = new FakeController();
    api = await startAutomation(controller);
    base = `http://127.0.0.1:${api.port}`;
  });
  afterEach(async () => {
    await api.close();
  });

  it("requires a strong bearer token even for health", async () => {
    expect(api.token).toMatch(/^[a-f0-9]{64}$/);
    expect((await fetch(`${base}/health`)).status).toBe(401);
    expect(
      (
        await request("/health", "GET", undefined, {
          Authorization: "Bearer incorrect",
        })
      ).status,
    ).toBe(401);
    expect((await request("/health")).status).toBe(200);
    expect(validAuthorization(`Bearer ${api.token}`, api.token)).toBe(true);
    expect(validAuthorization(`Bearer ${"f".repeat(64)}`, api.token)).toBe(
      false,
    );
  });

  it("rejects browser requests and DNS rebinding hosts even with valid credentials", async () => {
    const browserHeaders: Record<string, string>[] = [
      { Origin: "https://malicious.example" },
      { Origin: "null" },
      { "Sec-Fetch-Site": "same-origin" },
    ];
    for (const headers of browserHeaders) {
      expect(
        (await request("/health", "GET", undefined, headers)).status,
        JSON.stringify(headers),
      ).toBe(403);
    }
    for (const host of [
      `malicious.example:${api.port}`,
      `localhost:${api.port}`,
    ]) {
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const request = httpRequest(
            `${base}/health`,
            { headers: { Host: host, Authorization: `Bearer ${api.token}` } },
            (response) => {
              response.resume();
              resolve(response.statusCode);
            },
          );
          request.once("error", reject);
          request.end();
        },
      );
      expect(status).toBe(403);
    }
  });

  it("never lists or opens personal or ungranted manual agent spaces", async () => {
    expect(await (await request("/spaces")).json()).toEqual({ spaces: [] });
    const personal = controller.state.tabs[0];
    const manual = controller.state.tabs.find(
      (tab) => tab.spaceId === "manual-agent",
    )!;
    for (const tab of [personal, manual]) {
      expect((await request(`/tabs/${tab.id}/snapshot`)).status).toBe(404);
      expect(
        (
          await request(`/tabs/${tab.id}/navigate`, "POST", {
            url: "https://example.com/",
          })
        ).status,
      ).toBe(404);
      expect((await request(`/tabs/${tab.id}`, "DELETE")).status).toBe(404);
      expect((await request(`/spaces/${tab.spaceId}/tabs`)).status).toBe(404);
    }
    expect(controller.calls).toEqual([]);
    expect(controller.accessedTabs).toEqual([]);
  });

  it("accepts an explicit UI grant for an agent space and rejects grants for personal spaces", async () => {
    expect(() => api.grantSpace("personal")).toThrow();
    expect((await request("/spaces/manual-agent/tabs")).status).toBe(404);
    api.grantSpace("manual-agent");
    expect((await request("/spaces/manual-agent/tabs")).status).toBe(200);
    await controller.dispatch({
      type: "space:ownership",
      id: "manual-agent",
      owner: "human",
    });
    expect((await request("/spaces/manual-agent/tabs")).status).toBe(409);
    expect(() => api.grantSpace("manual-agent")).toThrow();
  });

  it("creates isolated background spaces and tabs without changing the personal selection", async () => {
    const selection = {
      space: controller.state.activeSpaceId,
      tab: controller.state.activeTabId,
    };
    const { space, tab } = await createPage();
    expect(space.kind).toBe("agent");
    expect(tab.spaceId).toBe(space.id);
    expect(controller.state.activeSpaceId).toBe(selection.space);
    expect(controller.state.activeTabId).toBe(selection.tab);
    const listed = await (await request("/spaces")).json();
    expect(listed.spaces.map((item: Space) => item.id)).toEqual([space.id]);
    expect(controller.calls[0]).toMatchObject({
      type: "tab:create",
      background: true,
      spaceId: space.id,
    });
  });

  it("blocks reads and actions after handoff until the human explicitly resumes", async () => {
    const { space, tab } = await createPage();
    expect(
      (await request(`/spaces/${space.id}/handoff`, "POST", {})).status,
    ).toBe(200);
    expect((await request(`/tabs/${tab.id}/snapshot`)).status).toBe(409);
    expect((await request(`/tabs/${tab.id}/screenshot`)).status).toBe(409);
    expect(
      (await request(`/tabs/${tab.id}/click`, "POST", { selector: "#submit" }))
        .status,
    ).toBe(409);
    expect(
      (
        await request(`/tabs/${tab.id}/navigate`, "POST", {
          url: "https://example.com/",
        })
      ).status,
    ).toBe(409);
    expect((await request(`/spaces/${space.id}`, "DELETE")).status).toBe(409);
    expect((await request(`/spaces/${space.id}/tabs`)).status).toBe(409);
    expect(
      (await request(`/spaces/${space.id}/resume`, "POST", {})).status,
    ).toBe(409);
    expect(controller.accessedTabs).toEqual([]);
    expect((await (await request("/spaces")).json()).spaces[0].owner).toBe(
      "human",
    );
    await controller.dispatch({
      type: "space:ownership",
      id: space.id,
      owner: "agent",
    });
    const snapshot = await request(`/tabs/${tab.id}/snapshot`);
    expect(snapshot.status).toBe(200);
    expect((await snapshot.json()).text).toBe("Hello from the agent page");
    expect(controller.contents.scripts[0].worldId).toBe(1001);
  });

  it("withholds an in-flight snapshot if the human takes over before it resolves", async () => {
    const { space, tab } = await createPage();
    let resolveSnapshot!: (value: unknown) => void;
    controller.contents.result = new Promise((resolve) => {
      resolveSnapshot = resolve;
    });
    const response = request(`/tabs/${tab.id}/snapshot`);
    await new Promise<void>((resolve) => {
      const check = () =>
        controller.contents.scripts.length ? resolve() : setTimeout(check, 1);
      check();
    });
    await controller.dispatch({
      type: "space:ownership",
      id: space.id,
      owner: "human",
    });
    resolveSnapshot({ text: "A human has now edited this page." });
    const result = await response;
    expect(result.status).toBe(409);
    expect(await result.text()).not.toContain("edited this page");
  });

  it("rejects unsafe URLs, oversized bodies, and malformed JSON", async () => {
    const space = await createSpace();
    for (const url of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,hello",
      "grove://newtab",
      "https://user:secret@example.com/",
      "example.com",
    ]) {
      expect(
        (await request(`/spaces/${space.id}/tabs`, "POST", { url })).status,
      ).toBe(400);
    }
    expect(
      (await request("/spaces", "POST", { name: "x".repeat(66000) })).status,
    ).toBe(413);
    expect((await request("/spaces", "POST", ["name"])).status).toBe(400);
    const invalid = await fetch(`${base}/spaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api.token}`,
        "Content-Type": "application/json",
      },
      body: "{bad",
    });
    expect(invalid.status).toBe(400);
    expect(
      (
        await fetch(`${base}/spaces`, {
          method: "POST",
          headers: { Authorization: `Bearer ${api.token}` },
          body: "{}",
        })
      ).status,
    ).toBe(415);
    expect(controller.calls).toEqual([]);
  });

  it("serializes selectors as data and exposes no evaluate endpoint", async () => {
    const { tab } = await createPage();
    const selector = '#field"); process.exit(); //';
    controller.contents.result = { ok: true };
    expect(
      (
        await request(`/tabs/${tab.id}/fill`, "POST", {
          selector,
          value: 'quote " and newline\n',
        })
      ).status,
    ).toBe(200);
    const executed = controller.contents.scripts[0];
    expect(
      executed.code.includes(
        `)("fill",${JSON.stringify({ selector, value: 'quote " and newline\n' })},`,
      ),
    ).toBe(true);
    expect(executed.worldId).toBe(1001);
    expect(
      (
        await request(`/tabs/${tab.id}/evaluate`, "POST", {
          code: "process.exit()",
        })
      ).status,
    ).toBe(404);
    expect(
      (await request(`/tabs/${tab.id}/snapshot?token=secret`)).status,
    ).toBe(400);
  });

  it("forgets provenance when the API restarts and rotates the token", async () => {
    const { space, tab } = await createPage();
    const previousToken = api.token;
    await api.close();
    api = await startAutomation(controller);
    base = `http://127.0.0.1:${api.port}`;
    expect(api.token).not.toBe(previousToken);
    expect((await request(`/spaces/${space.id}/tabs`)).status).toBe(404);
    expect((await request(`/tabs/${tab.id}/snapshot`)).status).toBe(404);
    expect(await (await request("/spaces")).json()).toEqual({ spaces: [] });
  });

  it("supports bounded compact, full, scoped, and controls-only observations", async () => {
    const { tab } = await createPage();
    expect((await request(`/tabs/${tab.id}/snapshot`)).status).toBe(200);
    expect(controller.contents.scripts.at(-1)!.code).toContain(
      '"mode":"compact","maxChars":4000,"maxControls":40',
    );
    expect(
      (
        await request(`/tabs/${tab.id}/snapshot`, "POST", {
          mode: "full",
          selector: "#form",
          maxChars: 0,
          maxControls: 7,
        })
      ).status,
    ).toBe(200);
    expect(controller.contents.scripts.at(-1)!.code).toContain(
      '"mode":"full","maxChars":0,"maxControls":7,"selector":"#form"',
    );
    for (const body of [
      { mode: "unknown" },
      { maxChars: -1 },
      { maxChars: 24001 },
      { maxControls: 101 },
      { maxControls: 1.5 },
      { selector: "" },
    ]) {
      expect(
        (await request(`/tabs/${tab.id}/snapshot`, "POST", body)).status,
      ).toBe(400);
    }
  });

  it("changes the reference namespace on document navigation and never reuses allocation ranges", async () => {
    const { tab } = await createPage();
    await request(`/tabs/${tab.id}/snapshot`);
    const first = controller.contents.scripts.at(-1)!.code;
    const firstRef = Number(first.match(/"firstRef":(\d+)/)![1]);
    expect(first.endsWith(`${tab.id}:0")`)).toBe(true);
    controller.contents.emit(
      "did-start-navigation",
      {},
      "https://example.com/next",
      false,
      true,
    );
    await request(`/tabs/${tab.id}/snapshot`);
    const second = controller.contents.scripts.at(-1)!.code;
    expect(Number(second.match(/"firstRef":(\d+)/)![1])).toBe(firstRef + 100);
    expect(second.endsWith(`${tab.id}:1")`)).toBe(true);
    controller.contents.emit(
      "did-start-navigation",
      {},
      "https://example.com/next#section",
      true,
      true,
    );
    await request(`/tabs/${tab.id}/snapshot`);
    expect(
      controller.contents.scripts.at(-1)!.code.endsWith(`${tab.id}:1")`),
    ).toBe(true);
  });

  it("rejects ambiguous targets and propagates stale refs without falling back to a selector", async () => {
    const { tab } = await createPage();
    for (const body of [
      {},
      { ref: "@e1", selector: "#field" },
      { ref: "@e0" },
      { ref: "#field" },
    ]) {
      expect(
        (
          await request(`/tabs/${tab.id}/fill`, "POST", {
            ...body,
            value: "test",
          })
        ).status,
      ).toBe(400);
    }
    controller.contents.result = {
      ok: false,
      code: "stale_ref",
      error: "Element reference is stale. Take a new snapshot.",
    };
    const response = await request(`/tabs/${tab.id}/fill`, "POST", {
      ref: "@e1",
      value: "test",
    });
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("stale_ref");
    expect(controller.contents.scripts).toHaveLength(1);
    expect(controller.contents.scripts[0].code).toContain(
      ')("fill",{"ref":"@e1","value":"test"}',
    );
  });

  it("validates an entire batch before performing any action", async () => {
    const { tab } = await createPage();
    const response = await request(`/tabs/${tab.id}/actions`, "POST", {
      actions: [
        { type: "fill", selector: "#field", value: "test" },
        { type: "evaluate", code: "process.exit()" },
      ],
    });
    expect(response.status).toBe(400);
    expect(controller.contents.scripts).toEqual([]);
    expect(
      (
        await request(`/tabs/${tab.id}/actions`, "POST", {
          actions: Array.from({ length: 21 }, () => ({ type: "snapshot" })),
        })
      ).status,
    ).toBe(400);
  });

  it("returns completed batch steps and stops at the first failed action without retrying", async () => {
    const { tab } = await createPage();
    controller.contents.result = (code: string) =>
      code.includes(')("fill",')
        ? { ok: true }
        : {
            ok: false,
            code: "stale_ref",
            error: "Element reference is stale.",
          };
    const response = await request(`/tabs/${tab.id}/actions`, "POST", {
      actions: [
        { type: "fill", ref: "@e1", value: "one" },
        { type: "click", ref: "@e2" },
        { type: "fill", ref: "@e3", value: "must not run" },
      ],
    });
    expect(response.status).toBe(422);
    const result = await response.json();
    expect(result).toMatchObject({
      ok: false,
      failedIndex: 1,
      error: { code: "stale_ref" },
      results: [{ index: 0, type: "fill", result: { ok: true } }],
    });
    expect(controller.contents.scripts).toHaveLength(2);
    expect(controller.contents.inputs).toEqual([]);
  });

  it("rechecks human ownership between batch steps and withholds earlier observations", async () => {
    const { tab, space } = await createPage();
    let observations = 0;
    controller.addActivity = () => {
      if (++observations === 1)
        controller.state.spaces.find((item) => item.id === space.id)!.owner =
          "human";
    };
    const response = await request(`/tabs/${tab.id}/actions`, "POST", {
      actions: [
        { type: "snapshot" },
        { type: "fill", selector: "#field", value: "must not run" },
      ],
    });
    expect(response.status).toBe(409);
    const result = await response.json();
    expect(result.error.code).toBe("human_control");
    expect(result.failedIndex).toBe(1);
    expect(result.results[0].result).toEqual({ ok: true, withheld: true });
    expect(JSON.stringify(result)).not.toContain("Hello from the agent page");
    expect(controller.contents.scripts).toHaveLength(1);
  });

  it("dispatches only fixed trusted mouse and keyboard input without changing selected tabs", async () => {
    const { tab } = await createPage();
    const activeTab = controller.state.activeTabId;
    controller.contents.result = { ok: true, x: 25, y: 45 };
    expect(
      (await request(`/tabs/${tab.id}/click`, "POST", { ref: "@e1" })).status,
    ).toBe(200);
    expect(
      controller.contents.inputs.map((input) => input.parameters.type),
    ).toEqual(["mouseMoved", "mousePressed", "mouseReleased"]);
    expect(
      controller.contents.inputs.every(
        (input) => input.method === "Input.dispatchMouseEvent",
      ),
    ).toBe(true);
    expect(controller.contents.debugger.isAttached()).toBe(false);
    controller.contents.inputs = [];
    expect(
      (
        await request(`/tabs/${tab.id}/press`, "POST", {
          key: "Enter",
          ref: "@e2",
        })
      ).status,
    ).toBe(200);
    expect(
      controller.contents.inputs.map((input) => input.parameters.type),
    ).toEqual(["keyDown", "keyUp"]);
    expect(
      controller.contents.inputs.every(
        (input) => input.method === "Input.dispatchKeyEvent",
      ),
    ).toBe(true);
    expect(controller.state.activeTabId).toBe(activeTab);
    for (const key of ["Control+W", "F12", "a", "constructor"])
      expect(
        (await request(`/tabs/${tab.id}/press`, "POST", { key })).status,
      ).toBe(400);
  });

  it("checks ownership immediately before each native input event", async () => {
    const { tab, space } = await createPage();
    controller.contents.result = { ok: true, x: 25, y: 45 };
    controller.contents.afterInput = () => {
      controller.state.spaces.find((item) => item.id === space.id)!.owner =
        "human";
    };
    expect(
      (await request(`/tabs/${tab.id}/click`, "POST", { ref: "@e1" })).status,
    ).toBe(409);
    expect(
      controller.contents.inputs.map((input) => input.parameters.type),
    ).toEqual(["mouseMoved"]);
    expect(controller.contents.debugger.isAttached()).toBe(false);
  });

  it("bounds wait and scroll without accepting arbitrary code or invalid motion", async () => {
    const { tab } = await createPage();
    controller.contents.result = { ok: true, matched: false };
    const timeout = await request(`/tabs/${tab.id}/wait`, "POST", {
      selector: "#late",
      timeoutMs: 0,
    });
    expect(timeout.status).toBe(408);
    expect((await timeout.json()).error.code).toBe("wait_timeout");
    expect(
      (await request(`/tabs/${tab.id}/wait`, "POST", { timeoutMs: 15001 }))
        .status,
    ).toBe(400);
    expect(
      (
        await request(`/tabs/${tab.id}/scroll`, "POST", {
          direction: "down",
          pixels: 2001,
        })
      ).status,
    ).toBe(400);
    controller.contents.result = { ok: true, x: 0, y: 600 };
    expect(
      (await request(`/tabs/${tab.id}/scroll`, "POST", { direction: "down" }))
        .status,
    ).toBe(200);
    expect(controller.contents.scripts.at(-1)!.code).toContain(
      ')("scroll",{"direction":"down","pixels":600}',
    );
  });
});
