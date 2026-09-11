import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { dialog, session, WebContentsView } from "electron";
import { BrowserController } from "../electron/controller";
import { HOME_URL, initialState, newTab } from "../shared/state";

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  WebContentsView: vi.fn(function () {
    return new FakeView();
  }),
  nativeTheme: { themeSource: "system" },
  session: {
    fromPartition: vi.fn((partition: string) => {
      if (!sessions.has(partition)) sessions.set(partition, new FakeSession());
      return sessions.get(partition)!;
    }),
  },
  dialog: { showMessageBox: vi.fn(), showSaveDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
}));
vi.mock("../electron/persistence", async (original) => ({
  ...(await original<typeof import("../electron/persistence")>()),
  writeState: vi.fn(),
}));

class FakeSession extends EventEmitter {
  setPermissionCheckHandler = vi.fn();
  setPermissionRequestHandler = vi.fn();
  clearStorageData = vi.fn(async () => {});
  clearCache = vi.fn(async () => {});
}
class FakeContents extends EventEmitter {
  url = "";
  destroyed = false;
  zoom = 0;
  pending: { url: string; reject: (reason: Error) => void }[] = [];
  navigationHistory = { canGoBack: () => false, canGoForward: () => false };
  setWindowOpenHandler = vi.fn();
  send = vi.fn();
  focus = () => this.emit("focus");
  isDestroyed = () => this.destroyed;
  getURL = () => this.url;
  getZoomLevel = () => this.zoom;
  setZoomLevel = (value: number) => {
    this.zoom = value;
  };
  reload = vi.fn();
  loadURL = vi.fn(
    (url: string) =>
      new Promise<void>((_resolve, reject) => {
        this.pending.push({ url, reject });
      }),
  );
  close() {
    // Chromium can finish stopping a navigation while a view is being closed.
    this.emit("did-stop-loading");
    this.destroyed = true;
  }
  commit(url: string) {
    this.url = url;
    this.emit("did-navigate", {}, url);
    this.emit("did-stop-loading");
  }
}
class FakeView {
  webContents = new FakeContents();
  visible = false;
  bounds = { x: 0, y: 0, width: 0, height: 0 };
  setVisible(value: boolean) {
    this.visible = value;
  }
  setBounds(value: typeof this.bounds) {
    this.bounds = value;
  }
}
const sessions = new Map<string, FakeSession>();
const controllers: BrowserController[] = [];
function controller() {
  const window = new EventEmitter() as EventEmitter & {
    webContents: FakeContents;
    contentView: {
      addChildView: ReturnType<typeof vi.fn>;
      removeChildView: ReturnType<typeof vi.fn>;
    };
    isDestroyed: () => boolean;
    getContentSize: () => number[];
  };
  window.webContents = new FakeContents();
  window.contentView = { addChildView: vi.fn(), removeChildView: vi.fn() };
  window.isDestroyed = () => false;
  window.getContentSize = () => [1400, 900];
  const result = new BrowserController(
    window as unknown as BrowserWindow,
    initialState(),
    "unused-test-state.json",
  );
  result.setContentBounds({
    x: 200,
    y: 80,
    width: 1000,
    height: 700,
    hidden: false,
  });
  controllers.push(result);
  return result;
}
function contents(browser: BrowserController, tabId: string) {
  return browser.getWebContents(tabId) as unknown as FakeContents;
}
function viewFor(contents: FakeContents) {
  return vi
    .mocked(WebContentsView)
    .mock.results.map((result) => result.value as FakeView)
    .find((view) => view.webContents === contents)!;
}
beforeEach(() => {
  sessions.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  for (const browser of controllers.splice(0)) browser.dispose();
});

describe("native browser lifecycle", () => {
  it("preserves a new-window form's POST body and referrer when opening its tab", async () => {
    const browser = controller();
    const sourceId = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id: sourceId,
      url: "https://example.com/form",
    });
    const source = contents(browser, sourceId);
    const open = source.setWindowOpenHandler.mock.calls[0][0];
    const referrer = {
      url: "https://example.com/form",
      policy: "strict-origin-when-cross-origin",
    };
    const postBody = {
      contentType: "application/x-www-form-urlencoded",
      data: [{ type: "rawData", bytes: Buffer.from("name=Probe") }],
    };
    expect(
      open({ url: "https://example.com/receipt", referrer, postBody }),
    ).toEqual({ action: "deny" });
    expect(browser.state.activeTabId).not.toBe(sourceId);
    const destination = contents(browser, browser.state.activeTabId);
    expect(destination.loadURL).toHaveBeenCalledWith(
      "https://example.com/receipt",
      {
        httpReferrer: referrer,
        postData: postBody.data,
        extraHeaders: "Content-Type: application/x-www-form-urlencoded",
      },
    );
  });

  it("does not reuse a microphone grant for a camera request", async () => {
    const browser = controller();
    const id = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/",
    });
    const page = contents(browser, id);
    page.commit("https://example.com/");
    const partition = session.fromPartition(
      "persist:space-personal",
    ) as unknown as FakeSession;
    const request = partition.setPermissionRequestHandler.mock.calls[0][0];
    const check = partition.setPermissionCheckHandler.mock.calls[0][0];
    vi.mocked(dialog.showMessageBox).mockResolvedValue({
      response: 1,
      checkboxChecked: false,
    });
    const microphone = vi.fn();
    request(page, "media", microphone, {
      requestingUrl: page.url,
      isMainFrame: true,
      mediaTypes: ["audio"],
    });
    await Promise.resolve();
    expect(microphone).toHaveBeenCalledWith(true);
    expect(
      check(page, "media", "https://example.com", { mediaType: "audio" }),
    ).toBe(true);
    expect(
      check(page, "media", "https://example.com", { mediaType: "video" }),
    ).toBe(false);
    expect(
      check(page, "media", "https://example.com", { mediaType: "unknown" }),
    ).toBe(false);
    expect(dialog.showMessageBox).toHaveBeenLastCalledWith(
      browser.window,
      expect.objectContaining({
        message: "https://example.com wants to use microphone.",
      }),
    );
    vi.mocked(dialog.showMessageBox).mockResolvedValue({
      response: 0,
      checkboxChecked: false,
    });
    const camera = vi.fn();
    request(page, "media", camera, {
      requestingUrl: page.url,
      isMainFrame: true,
      mediaTypes: ["video"],
    });
    await Promise.resolve();
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(2);
    expect(camera).toHaveBeenCalledWith(false);
  });

  it("rejects a pending permission when the requesting space is deleted", async () => {
    const browser = controller();
    const tab = browser.state.tabs.find((item) => item.spaceId === "work")!;
    await browser.dispatch({
      type: "tab:navigate",
      id: tab.id,
      url: "https://example.com/",
    });
    const page = contents(browser, tab.id);
    page.commit("https://example.com/");
    const partition = session.fromPartition(
      "persist:space-work",
    ) as unknown as FakeSession;
    const request = partition.setPermissionRequestHandler.mock.calls[0][0];
    let answer!: (value: {
      response: number;
      checkboxChecked: boolean;
    }) => void;
    vi.mocked(dialog.showMessageBox).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const callback = vi.fn();
    request(page, "notifications", callback, {
      requestingUrl: page.url,
      isMainFrame: true,
    });
    await browser.dispatch({ type: "space:delete", id: "work" });
    answer({ response: 1, checkboxChecked: false });
    await Promise.resolve();
    expect(callback).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("rejects a pending permission after a reload at the same URL", async () => {
    const browser = controller();
    const tab = browser.state.tabs[0];
    await browser.dispatch({
      type: "tab:navigate",
      id: tab.id,
      url: "https://example.com/",
    });
    const page = contents(browser, tab.id);
    page.commit("https://example.com/");
    const partition = session.fromPartition(
      "persist:space-personal",
    ) as unknown as FakeSession;
    const request = partition.setPermissionRequestHandler.mock.calls[0][0];
    let answer!: (value: {
      response: number;
      checkboxChecked: boolean;
    }) => void;
    vi.mocked(dialog.showMessageBox).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const callback = vi.fn();
    request(page, "notifications", callback, {
      requestingUrl: page.url,
      isMainFrame: true,
    });
    page.emit("did-start-navigation", {
      isMainFrame: true,
      isSameDocument: false,
    });
    answer({ response: 1, checkboxChecked: false });
    await Promise.resolve();
    expect(callback).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("denies website permissions and downloads in human-owned agent spaces", async () => {
    const browser = controller();
    await browser.dispatch({
      type: "space:create",
      kind: "agent",
      color: "purple",
      name: "Manual task",
    });
    const id = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/",
    });
    const partition = [...sessions.values()][0];
    const request = partition.setPermissionRequestHandler.mock.calls[0][0];
    const callback = vi.fn();
    request(contents(browser, id), "notifications", callback, {
      requestingUrl: "https://example.com/",
      isMainFrame: true,
    });
    expect(callback).toHaveBeenCalledExactlyOnceWith(false);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    const event = { preventDefault: vi.fn() };
    partition.emit("will-download", event, {});
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(browser.state.downloads).toHaveLength(0);
  });

  it("enforces the tab limit before creating either kind of space", async () => {
    const browser = controller();
    while (browser.state.tabs.length < 200)
      browser.state.tabs.push(newTab("personal"));
    const spaces = browser.state.spaces.length;
    await expect(
      browser.dispatch({
        type: "space:create",
        kind: "personal",
        color: "green",
        name: "Full",
      }),
    ).rejects.toThrow("200 tabs");
    await expect(
      browser.dispatch({
        type: "space:create",
        kind: "agent",
        color: "purple",
        name: "Full",
      }),
    ).rejects.toThrow("200 tabs");
    expect(() => browser.createAgentSpace("Full")).toThrow("200 tabs");
    expect(browser.state.spaces).toHaveLength(spaces);
    expect(browser.state.tabs).toHaveLength(200);
  });

  it("preserves a closed tab when reopening it would exceed the tab limit", async () => {
    const browser = controller();
    const original = browser.state.tabs[0];
    original.title = "Reopen me";
    await browser.dispatch({ type: "tab:close", id: original.id });
    while (browser.state.tabs.length < 200)
      browser.state.tabs.push(newTab("personal"));
    await expect(browser.dispatch({ type: "tab:reopen" })).rejects.toThrow(
      "200 tabs",
    );
    expect(browser.state.tabs).toHaveLength(200);
    await browser.dispatch({
      type: "tab:close",
      id: browser.state.tabs.at(-1)!.id,
    });
    // Consume the most recently closed tab before retrying the older entry.
    await browser.dispatch({ type: "tab:reopen" });
    browser.state.tabs.pop();
    await browser.dispatch({ type: "tab:reopen" });
    expect(
      browser.state.tabs.find((tab) => tab.id === browser.state.activeTabId)
        ?.title,
    ).toBe("Reopen me");
  });

  it("selects the neighboring tab within its own space after closing a tab", async () => {
    const browser = controller();
    const work = browser.state.tabs.find((tab) => tab.spaceId === "work")!;
    const next = newTab("work");
    const last = newTab("work");
    browser.state.tabs.push(next, last);
    await browser.dispatch({ type: "tab:activate", id: work.id });
    await browser.dispatch({ type: "tab:close", id: work.id });
    expect(browser.state.activeTabId).toBe(next.id);
  });

  it("keeps Home active when a removed page finishes stopping", async () => {
    const browser = controller();
    const id = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/",
    });
    contents(browser, id).commit("https://example.com/");
    await browser.dispatch({ type: "tab:navigate", id, url: HOME_URL });
    expect(browser.state.tabs.find((tab) => tab.id === id)?.url).toBe(HOME_URL);
    expect(browser.getWebContents(id)).toBeUndefined();
    expect(WebContentsView).toHaveBeenCalledTimes(1);
  });

  it("ends split view when opening a new blank tab", async () => {
    const browser = controller();
    const first = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id: first,
      url: "https://example.com/",
    });
    await browser.dispatch({
      type: "tab:create",
      url: "https://example.org/",
      background: true,
    });
    const second = browser.state.tabs.find(
      (tab) => tab.url === "https://example.org/",
    )!.id;
    await browser.dispatch({ type: "tab:split", id: second });
    await browser.dispatch({ type: "tab:create" });
    expect(browser.state.splitTabId).toBeNull();
    expect(viewFor(contents(browser, second)).visible).toBe(false);
  });

  it("applies page controls to the focused split pane without moving either pane", async () => {
    const browser = controller();
    const first = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id: first,
      url: "https://example.com/",
    });
    await browser.dispatch({
      type: "tab:create",
      url: "https://example.org/",
      background: true,
    });
    const second = browser.state.tabs.find(
      (tab) => tab.url === "https://example.org/",
    )!.id;
    await browser.dispatch({ type: "tab:split", id: second });
    const left = contents(browser, first);
    const right = contents(browser, second);
    const leftBounds = { ...viewFor(left).bounds };
    const rightBounds = { ...viewFor(right).bounds };
    right.focus();
    await browser.dispatch({ type: "page:zoom", direction: "in" });
    expect(browser.state.activeTabId).toBe(second);
    expect(right.zoom).toBe(1);
    expect(left.zoom).toBe(0);
    expect(viewFor(left).bounds).toEqual(leftBounds);
    expect(viewFor(right).bounds).toEqual(rightBounds);
    left.emit("before-mouse-event", {}, { type: "mouseMove" });
    expect(browser.state.activeTabId).toBe(second);
    left.emit("before-mouse-event", {}, { type: "mouseDown" });
    expect(browser.state.activeTabId).toBe(first);
    expect(viewFor(left).bounds).toEqual(leftBounds);
  });

  it("ignores a rejected older load after a newer destination succeeds", async () => {
    const browser = controller();
    const id = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/slow",
    });
    const page = contents(browser, id);
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/new",
    });
    page.commit("https://example.com/new");
    page.pending[0].reject(new Error("ERR_CONNECTION_RESET"));
    await Promise.resolve();
    expect(
      browser.state.tabs.find((tab) => tab.id === id)?.error,
    ).toBeUndefined();
  });

  it("keeps the failed destination visible instead of replacing it with the previous page URL", async () => {
    const browser = controller();
    const id = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/previous",
    });
    const page = contents(browser, id);
    page.commit("https://example.com/previous");
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/failing",
    });
    page.emit(
      "did-fail-load",
      {},
      -102,
      "ERR_CONNECTION_REFUSED",
      "https://example.com/failing",
      true,
    );
    page.emit("did-stop-loading");
    expect(browser.state.tabs.find((tab) => tab.id === id)?.url).toBe(
      "https://example.com/failing",
    );
    await browser.dispatch({ type: "tab:reload", id });
    expect(page.loadURL).toHaveBeenLastCalledWith(
      "https://example.com/failing",
    );
    expect(page.reload).not.toHaveBeenCalled();
  });

  it("ignores an old request failure after a page starts its own navigation", async () => {
    const browser = controller();
    const id = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/previous",
    });
    const page = contents(browser, id);
    page.emit("did-start-navigation", {
      isMainFrame: true,
      isSameDocument: false,
      url: "https://example.com/new",
    });
    page.commit("https://example.com/new");
    page.pending[0].reject(new Error("ERR_CONNECTION_RESET"));
    await Promise.resolve();
    expect(
      browser.state.tabs.find((tab) => tab.id === id)?.error,
    ).toBeUndefined();
  });

  it("keeps a failed page recoverable through unrelated loading notifications", async () => {
    const browser = controller();
    const id = browser.state.activeTabId;
    await browser.dispatch({
      type: "tab:navigate",
      id,
      url: "https://example.com/failing",
    });
    const page = contents(browser, id);
    page.emit(
      "did-fail-load",
      {},
      -102,
      "ERR_CONNECTION_REFUSED",
      "https://example.com/failing",
      true,
    );
    page.emit("did-start-loading");
    page.emit("did-stop-loading");
    expect(browser.state.tabs.find((tab) => tab.id === id)?.error).toBe(
      "ERR_CONNECTION_REFUSED",
    );
    await browser.dispatch({ type: "tab:reload", id });
    expect(
      browser.state.tabs.find((tab) => tab.id === id)?.error,
    ).toBeUndefined();
    expect(page.loadURL).toHaveBeenLastCalledWith(
      "https://example.com/failing",
    );
  });

  it("clears a deleted personal partition even if no tab opened it this launch", async () => {
    const browser = controller();
    const existing = session.fromPartition(
      "persist:space-work",
    ) as unknown as FakeSession;
    await browser.dispatch({ type: "space:delete", id: "work" });
    expect(existing.clearStorageData).toHaveBeenCalledOnce();
    expect(existing.clearCache).toHaveBeenCalledOnce();
  });

  it("removes session download listeners when its window closes", async () => {
    const browser = controller();
    await browser.dispatch({
      type: "tab:navigate",
      id: browser.state.activeTabId,
      url: "https://example.com/",
    });
    const partition = session.fromPartition(
      "persist:space-personal",
    ) as unknown as FakeSession;
    expect(partition.listenerCount("will-download")).toBe(1);
    browser.dispose();
    expect(partition.listenerCount("will-download")).toBe(0);
  });
});
