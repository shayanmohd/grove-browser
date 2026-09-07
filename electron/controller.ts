import {
  BrowserWindow,
  dialog,
  nativeTheme,
  session,
  shell,
  WebContentsView,
} from "electron";
import type { Session, WebContents } from "electron";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { HOME_URL, newTab } from "../shared/state";
import { isWebUrl, normalizeUrl } from "../shared/url";
import type {
  Activity,
  BrowserAction,
  BrowserState,
  ContentBounds,
  Space,
  SpaceColor,
  Tab,
} from "../shared/types";
import { validSettings, writeState } from "./persistence";

const colors: SpaceColor[] = ["green", "blue", "orange", "purple"];
const cleanText = (value: unknown, maximum = 300): string => {
  if (typeof value !== "string" || value.length > maximum)
    throw new Error("Invalid text value.");
  return value.trim();
};

export class BrowserController {
  readonly state: BrowserState;
  private views = new Map<string, WebContentsView>();
  private sessions = new Map<string, Session>();
  private sessionCleanups = new Map<string, () => void>();
  private pendingLoads = new Map<string, symbol>();
  private listeners = new Set<(state: BrowserState) => void>();
  private closedTabs: Tab[] = [];
  private lastActive = new Map<string, string>();
  private bounds: ContentBounds = {
    x: 248,
    y: 82,
    width: 950,
    height: 718,
    hidden: true,
  };
  private saveTimer?: NodeJS.Timeout;
  private destroyed = false;
  private runId = randomUUID();
  private lastFind = { text: "", tabId: "" };
  private splitLeadingTabId: string | null = null;

  constructor(
    readonly window: BrowserWindow,
    state: BrowserState,
    private statePath: string,
  ) {
    this.state = state;
    nativeTheme.themeSource = state.settings.theme;
    this.bindShortcuts(window.webContents);
    window.on("resize", () => this.layout());
    this.layout();
  }

  subscribe(listener: (state: BrowserState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): BrowserState {
    if (this.destroyed) return this.state;
    this.layout();
    if (!this.window.isDestroyed() && !this.window.webContents.isDestroyed())
      this.window.webContents.send("grove:state-changed", this.state);
    for (const listener of this.listeners) listener(this.state);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 350);
    return this.state;
  }

  private persist(): void {
    try {
      writeState(this.statePath, this.state);
    } catch (error) {
      console.error(
        "Unable to save browser state:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  addActivity(
    spaceId: string | undefined,
    message: string,
    kind: Activity["kind"] = "info",
  ): void {
    this.state.activity.unshift({
      id: randomUUID(),
      spaceId,
      message: message.slice(0, 500),
      kind,
      time: Date.now(),
    });
    this.state.activity = this.state.activity.slice(0, 100);
    this.emit();
  }

  setAutomation(running: boolean, port: number | null): void {
    this.state.automation = { running, port };
    this.emit();
  }

  setContentBounds(bounds: ContentBounds): void {
    if (
      !bounds ||
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    )
      return;
    const [width, height] = this.window.getContentSize();
    this.bounds = {
      x: Math.max(0, Math.min(width, Math.round(bounds.x))),
      y: Math.max(0, Math.min(height, Math.round(bounds.y))),
      width: Math.max(0, Math.min(width, Math.round(bounds.width))),
      height: Math.max(0, Math.min(height, Math.round(bounds.height))),
      hidden: !!bounds.hidden,
    };
    this.layout();
  }

  private layout(): void {
    if (this.destroyed || this.window.isDestroyed()) return;
    const active = this.state.tabs.find(
      (tab) => tab.id === this.state.activeTabId,
    );
    const other = this.state.tabs.find(
      (tab) => tab.id === this.state.splitTabId,
    );
    if (
      !active ||
      !other ||
      active.id === other.id ||
      active.spaceId !== other.spaceId ||
      !isWebUrl(active.url) ||
      !isWebUrl(other.url)
    ) {
      this.state.splitTabId = null;
      this.splitLeadingTabId = null;
    } else if (
      this.splitLeadingTabId !== active.id &&
      this.splitLeadingTabId !== other.id
    ) {
      this.splitLeadingTabId = active.id;
    }
    const { activeTabId, splitTabId } = this.state;
    const ids = [activeTabId, splitTabId].filter((id): id is string => !!id);
    const [windowWidth, windowHeight] = this.window.getContentSize();
    const area = {
      ...this.bounds,
      width: Math.max(
        0,
        Math.min(this.bounds.width, windowWidth - this.bounds.x),
      ),
      height: Math.max(
        0,
        Math.min(this.bounds.height, windowHeight - this.bounds.y),
      ),
    };
    for (const id of ids) {
      const tab = this.state.tabs.find((item) => item.id === id);
      if (tab && isWebUrl(tab.url)) this.ensureView(tab);
    }
    for (const [id, view] of this.views) {
      const tab = this.state.tabs.find((item) => item.id === id);
      const visible =
        !area.hidden &&
        area.width > 0 &&
        area.height > 0 &&
        ids.includes(id) &&
        !!tab &&
        tab.url !== HOME_URL &&
        !tab.error;
      view.setVisible(visible);
      if (visible) {
        const split = !!splitTabId;
        const gap = split ? 8 : 0;
        const leftWidth = split
          ? Math.floor((area.width - gap) / 2)
          : area.width;
        const second = split && id !== this.splitLeadingTabId;
        view.setBounds({
          x: area.x + (second ? leftWidth + gap : 0),
          y: area.y,
          width: second ? area.width - leftWidth - gap : leftWidth,
          height: area.height,
        });
      }
    }
  }

  private getSpace(id: string): Space {
    const space = this.state.spaces.find((item) => item.id === id);
    if (!space) throw new Error("Space was not found.");
    return space;
  }

  private getTab(id: string): Tab {
    const tab = this.state.tabs.find((item) => item.id === id);
    if (!tab) throw new Error("Tab was not found.");
    return tab;
  }

  private sessionFor(space: Space): Session {
    const existing = this.sessions.get(space.id);
    if (existing) return existing;
    const partition =
      space.kind === "agent"
        ? `agent-${this.runId}-${space.id}`
        : `persist:space-${space.id}`;
    const browsingSession = session.fromPartition(partition);
    this.sessions.set(space.id, browsingSession);
    const granted = new Set<string>();
    const permissionKey = (origin: string, permission: string) =>
      `${origin}|${permission}`;
    browsingSession.setPermissionCheckHandler(
      (_contents, permission, origin) =>
        space.kind !== "agent" &&
        granted.has(permissionKey(origin, permission)),
    );
    browsingSession.setPermissionRequestHandler(
      (contents, permission, callback, details) => {
        if (
          space.kind === "agent" ||
          !contents ||
          contents.isDestroyed() ||
          this.window.isDestroyed()
        ) {
          callback(false);
          return;
        }
        const allowed = [
          "media",
          "geolocation",
          "notifications",
          "clipboard-read",
          "clipboard-sanitized-write",
          "fullscreen",
          "pointerLock",
          "display-capture",
          "speaker-selection",
        ];
        if (!allowed.includes(permission)) {
          callback(false);
          return;
        }
        let origin: string;
        try {
          origin = new URL(details.requestingUrl || contents.getURL()).origin;
        } catch {
          callback(false);
          return;
        }
        if (granted.has(permissionKey(origin, permission))) {
          callback(true);
          return;
        }
        void dialog
          .showMessageBox(this.window, {
            type: "question",
            title: "Website permission",
            message: `${origin} wants to use ${permission}.`,
            detail: `This permission applies to the ${space.name} space for this browser session.`,
            buttons: ["Block", "Allow"],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          })
          .then(({ response }) => {
            if (response === 1) granted.add(permissionKey(origin, permission));
            callback(response === 1);
          })
          .catch(() => callback(false));
      },
    );
    const onDownload = (event: Electron.Event, item: Electron.DownloadItem) => {
      if (space.kind === "agent") {
        event.preventDefault();
        this.addActivity(
          space.id,
          "A download was blocked in the isolated agent space.",
          "warning",
        );
        return;
      }
      item.setSaveDialogOptions({ title: "Save download" });
      const download = {
        id: randomUUID(),
        filename: item.getFilename(),
        receivedBytes: 0,
        totalBytes: item.getTotalBytes(),
        state: "progressing" as
          | "progressing"
          | "completed"
          | "cancelled"
          | "interrupted",
        path: "",
      };
      this.state.downloads.unshift(download);
      this.state.downloads = this.state.downloads.slice(0, 100);
      item.on("updated", (_event, status) => {
        download.receivedBytes = item.getReceivedBytes();
        download.totalBytes = item.getTotalBytes();
        download.state = status;
        download.path = item.getSavePath();
        this.emit();
      });
      item.once("done", (_event, status) => {
        download.state = status;
        download.path = item.getSavePath();
        download.receivedBytes = item.getReceivedBytes();
        this.addActivity(
          space.id,
          `${download.filename}: ${status}.`,
          status === "completed" ? "success" : "warning",
        );
      });
      this.emit();
    };
    browsingSession.on("will-download", onDownload);
    this.sessionCleanups.set(space.id, () => {
      browsingSession.removeListener("will-download", onDownload);
      browsingSession.setPermissionCheckHandler(() => false);
      browsingSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
    });
    return browsingSession;
  }

  getWebContents(tabId: string): WebContents | undefined {
    const tab = this.state.tabs.find((item) => item.id === tabId);
    if (!tab || tab.url === HOME_URL) return undefined;
    return this.ensureView(tab).webContents;
  }

  private ensureView(tab: Tab): WebContentsView {
    const existing = this.views.get(tab.id);
    if (existing) return existing;
    const space = this.getSpace(tab.spaceId);
    const view = new WebContentsView({
      webPreferences: {
        session: this.sessionFor(space),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        navigateOnDragDrop: false,
        spellcheck: true,
      },
    });
    this.views.set(tab.id, view);
    this.window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 1200, height: 800 });
    view.setVisible(false);
    const contents = view.webContents;
    const isCurrentView = () =>
      !this.destroyed &&
      !contents.isDestroyed() &&
      this.views.get(tab.id) === view &&
      this.state.tabs.includes(tab);
    this.bindShortcuts(contents);
    contents.on("focus", () => {
      if (
        !isCurrentView() ||
        this.bounds.hidden ||
        tab.id === this.state.activeTabId ||
        tab.id !== this.state.splitTabId
      )
        return;
      this.activate(tab);
      this.emit();
    });
    contents.setWindowOpenHandler(({ url }) => {
      if (isCurrentView() && isWebUrl(url))
        void this.dispatch({
          type: "tab:create",
          url,
          spaceId: tab.spaceId,
          background: space.kind === "agent",
        }).catch(() => undefined);
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
      if (!isWebUrl(url)) event.preventDefault();
    });
    contents.on("will-redirect", (event, url) => {
      if (!isWebUrl(url)) event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.on("did-start-navigation", (details) => {
      if (!isCurrentView() || !details.isMainFrame || !isWebUrl(details.url))
        return;
      tab.url = details.url;
      delete tab.error;
      if (!details.isSameDocument) {
        tab.title = details.url;
        delete tab.favicon;
      }
      this.emit();
    });
    contents.on("did-redirect-navigation", (details) => {
      if (!isCurrentView() || !details.isMainFrame || !isWebUrl(details.url))
        return;
      tab.url = details.url;
      this.emit();
    });
    const updateNavigation = () => {
      if (!isCurrentView()) return;
      const url = contents.getURL();
      if (isWebUrl(url) && !tab.error) tab.url = url;
      tab.canGoBack = contents.navigationHistory.canGoBack();
      tab.canGoForward = contents.navigationHistory.canGoForward();
      this.emit();
    };
    contents.on("did-start-loading", () => {
      if (!isCurrentView()) return;
      // Subframes and error documents can also start loading. A new main-frame
      // navigation or deliberate retry is responsible for clearing errors.
      tab.loading = true;
      this.emit();
    });
    contents.on("did-stop-loading", () => {
      if (!isCurrentView()) return;
      tab.loading = false;
      updateNavigation();
    });
    contents.on("did-navigate", () => {
      if (!isCurrentView()) return;
      delete tab.error;
      updateNavigation();
      this.recordVisit(tab);
    });
    contents.on("did-navigate-in-page", (_event, _url, mainFrame) => {
      if (mainFrame && isCurrentView()) {
        updateNavigation();
        this.recordVisit(tab);
      }
    });
    contents.on("page-title-updated", (_event, title) => {
      if (!isCurrentView()) return;
      tab.title = title.slice(0, 300) || tab.url;
      const latest = this.state.history.find((entry) => entry.url === tab.url);
      if (latest && space.kind === "personal") latest.title = tab.title;
      this.emit();
    });
    contents.on("page-favicon-updated", (_event, favicons) => {
      if (!isCurrentView()) return;
      tab.favicon = favicons.find((url) => isWebUrl(url));
      this.emit();
    });
    contents.on(
      "did-fail-load",
      (_event, code, description, url, mainFrame) => {
        if (
          !isCurrentView() ||
          !mainFrame ||
          code === -3 ||
          (isWebUrl(url) && url !== tab.url)
        )
          return;
        tab.loading = false;
        tab.error = description || "This page could not be loaded.";
        this.emit();
      },
    );
    contents.on("render-process-gone", (_event, details) => {
      if (!isCurrentView()) return;
      tab.loading = false;
      tab.error = `The page process stopped (${details.reason}). Reload to try again.`;
      this.emit();
    });
    contents.on("context-menu", (_event, params) => {
      import("electron")
        .then(({ Menu }) => {
          if (!isCurrentView() || this.window.isDestroyed()) return;
          const template: Electron.MenuItemConstructorOptions[] = [];
          if (isWebUrl(params.linkURL))
            template.push(
              {
                label: "Open link in new tab",
                click: () => {
                  void this.dispatch({
                    type: "tab:create",
                    url: params.linkURL,
                    spaceId: tab.spaceId,
                    background: true,
                  }).catch(() => undefined);
                },
              },
              { type: "separator" },
            );
          if (params.isEditable)
            template.push(
              { role: "undo" },
              { role: "redo" },
              { type: "separator" },
              { role: "cut" },
              { role: "copy" },
              { role: "paste" },
              { role: "selectAll" },
            );
          else if (params.selectionText) template.push({ role: "copy" });
          else
            template.push(
              {
                label: "Back",
                enabled: tab.canGoBack,
                click: () => {
                  contents.navigationHistory.goBack();
                },
              },
              {
                label: "Forward",
                enabled: tab.canGoForward,
                click: () => {
                  contents.navigationHistory.goForward();
                },
              },
              { label: "Reload", click: () => contents.reload() },
            );
          Menu.buildFromTemplate(template).popup({ window: this.window });
        })
        .catch(() => undefined);
    });
    this.load(tab, contents);
    return view;
  }

  private load(tab: Tab, contents: WebContents): void {
    if (!isWebUrl(tab.url)) return;
    const request = Symbol();
    const requestedUrl = tab.url;
    this.pendingLoads.set(tab.id, request);
    tab.loading = true;
    delete tab.error;
    void contents.loadURL(tab.url).catch((error) => {
      if (
        contents.isDestroyed() ||
        this.views.get(tab.id)?.webContents !== contents ||
        this.pendingLoads.get(tab.id) !== request ||
        tab.url !== requestedUrl ||
        !this.state.tabs.includes(tab) ||
        String(error).includes("ERR_ABORTED")
      )
        return;
      tab.loading = false;
      tab.error =
        "This page could not be loaded. Check the address and connection, then try again.";
      this.emit();
    });
  }

  private recordVisit(tab: Tab): void {
    if (this.getSpace(tab.spaceId).kind === "agent" || !isWebUrl(tab.url))
      return;
    this.state.history = this.state.history.filter(
      (entry) => entry.url !== tab.url,
    );
    this.state.history.unshift({
      id: randomUUID(),
      title: tab.title,
      url: tab.url,
      visitedAt: Date.now(),
    });
    this.state.history = this.state.history.slice(0, 1000);
    this.emit();
  }

  private activate(tab: Tab): void {
    this.lastActive.set(this.state.activeSpaceId, this.state.activeTabId);
    if (this.state.activeSpaceId !== tab.spaceId) this.state.splitTabId = null;
    if (this.state.splitTabId === tab.id)
      this.state.splitTabId = this.state.activeTabId;
    else if (this.splitLeadingTabId === this.state.activeTabId)
      this.splitLeadingTabId = tab.id;
    this.state.activeSpaceId = tab.spaceId;
    this.state.activeTabId = tab.id;
  }

  private destroyTab(id: string): void {
    const view = this.views.get(id);
    if (!view) return;
    this.views.delete(id);
    this.pendingLoads.delete(id);
    if (!this.window.isDestroyed())
      this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed())
      view.webContents.close({ waitForBeforeUnload: false });
  }

  createAgentSpace(name: string, color: SpaceColor = "purple"): Space {
    if (this.state.spaces.length >= 30)
      throw new Error("The maximum of 30 spaces has been reached.");
    const space: Space = {
      id: randomUUID(),
      name: cleanText(name, 48) || "Agent space",
      color: colors.includes(color) ? color : "purple",
      kind: "agent",
      owner: "agent",
      createdAt: Date.now(),
    };
    this.state.spaces.push(space);
    this.state.tabs.push(newTab(space.id));
    this.addActivity(
      space.id,
      `${space.name} started in an isolated session.`,
      "info",
    );
    return space;
  }

  async dispatch(action: BrowserAction): Promise<BrowserState> {
    if (
      !action ||
      typeof action !== "object" ||
      typeof action.type !== "string"
    )
      throw new Error("Invalid browser action.");
    if (this.destroyed) throw new Error("Browser is closing.");
    switch (action.type) {
      case "tab:create": {
        if (this.state.tabs.length >= 200)
          throw new Error("The maximum of 200 tabs has been reached.");
        const space = this.getSpace(action.spaceId ?? this.state.activeSpaceId);
        const tab = newTab(
          space.id,
          normalizeUrl(
            action.url === undefined ? "" : cleanText(action.url, 8192),
            this.state.settings.searchEngine,
          ),
        );
        this.state.tabs.push(tab);
        if (!action.background) this.activate(tab);
        if (isWebUrl(tab.url)) this.ensureView(tab);
        break;
      }
      case "tab:activate":
        this.activate(this.getTab(action.id));
        break;
      case "tab:navigate": {
        const tab = this.getTab(action.id);
        tab.url = normalizeUrl(
          cleanText(action.url, 8192),
          this.state.settings.searchEngine,
        );
        tab.title = tab.url === HOME_URL ? "New tab" : tab.url;
        delete tab.favicon;
        delete tab.error;
        if (tab.url === HOME_URL) {
          this.destroyTab(tab.id);
          tab.loading = false;
          tab.canGoBack = false;
          tab.canGoForward = false;
        } else {
          const view = this.views.get(tab.id);
          if (view) this.load(tab, view.webContents);
          else this.ensureView(tab);
        }
        break;
      }
      case "tab:close": {
        const tab = this.getTab(action.id);
        this.closedTabs.unshift({ ...tab });
        this.closedTabs = this.closedTabs.slice(0, 20);
        const index = this.state.tabs.indexOf(tab);
        this.state.tabs.splice(index, 1);
        this.destroyTab(tab.id);
        if (this.state.splitTabId === tab.id) this.state.splitTabId = null;
        let candidates = this.state.tabs.filter(
          (item) => item.spaceId === tab.spaceId,
        );
        if (!candidates.length) {
          const replacement = newTab(tab.spaceId);
          this.state.tabs.push(replacement);
          candidates = [replacement];
        }
        if (this.state.activeTabId === tab.id) {
          const next =
            candidates.find((item) => item.id === this.state.splitTabId) ??
            candidates[Math.min(candidates.length - 1, index)];
          this.state.splitTabId = null;
          this.activate(next);
        }
        break;
      }
      case "tab:reopen": {
        const old = this.closedTabs.shift();
        if (
          old &&
          this.state.spaces.some((space) => space.id === old.spaceId)
        ) {
          const tab = {
            ...newTab(old.spaceId, old.url),
            title: old.title,
            pinned: old.pinned,
          };
          this.state.tabs.push(tab);
          this.activate(tab);
        }
        break;
      }
      case "tab:pin": {
        const tab = this.getTab(action.id);
        tab.pinned = !tab.pinned;
        break;
      }
      case "tab:duplicate": {
        const tab = this.getTab(action.id);
        return this.dispatch({
          type: "tab:create",
          url: tab.url,
          spaceId: tab.spaceId,
        });
      }
      case "tab:back":
      case "tab:forward":
      case "tab:reload":
      case "tab:stop": {
        const tab = this.getTab(action.id);
        const contents = this.getWebContents(tab.id);
        if (contents) {
          if (
            action.type === "tab:back" &&
            contents.navigationHistory.canGoBack()
          )
            contents.navigationHistory.goBack();
          if (
            action.type === "tab:forward" &&
            contents.navigationHistory.canGoForward()
          )
            contents.navigationHistory.goForward();
          if (action.type === "tab:reload") {
            if (tab.error) this.load(tab, contents);
            else contents.reload();
          }
          if (action.type === "tab:stop") {
            contents.stop();
            tab.loading = false;
          }
        }
        break;
      }
      case "tab:split": {
        if (action.id === null) this.state.splitTabId = null;
        else {
          const tab = this.getTab(action.id);
          if (
            tab.spaceId !== this.state.activeSpaceId ||
            tab.id === this.state.activeTabId ||
            !isWebUrl(tab.url) ||
            !isWebUrl(this.getTab(this.state.activeTabId).url)
          )
            throw new Error("Open two web pages in this space for split view.");
          this.state.splitTabId = tab.id;
          this.splitLeadingTabId = this.state.activeTabId;
        }
        break;
      }
      case "space:create": {
        if (
          !["personal", "agent"].includes(action.kind) ||
          !colors.includes(action.color)
        )
          throw new Error("Invalid space options.");
        if (this.state.spaces.length >= 30)
          throw new Error("The maximum of 30 spaces has been reached.");
        const name = cleanText(action.name, 48) || "Untitled space";
        let space: Space;
        if (action.kind === "agent") {
          space = this.createAgentSpace(name, action.color);
          space.owner = "human";
        } else {
          space = {
            id: randomUUID(),
            name,
            color: action.color,
            kind: "personal",
            owner: "human",
            createdAt: Date.now(),
          };
          this.state.spaces.push(space);
          this.state.tabs.push(newTab(space.id));
        }
        this.activate(this.state.tabs.find((tab) => tab.spaceId === space.id)!);
        break;
      }
      case "space:activate": {
        const space = this.getSpace(action.id);
        const tab =
          this.state.tabs.find(
            (item) =>
              item.id === this.lastActive.get(space.id) &&
              item.spaceId === space.id,
          ) ?? this.state.tabs.find((item) => item.spaceId === space.id)!;
        this.activate(tab);
        break;
      }
      case "space:rename":
        this.getSpace(action.id).name =
          cleanText(action.name, 48) || "Untitled space";
        break;
      case "space:ownership": {
        const space = this.getSpace(action.id);
        if (
          space.kind !== "agent" ||
          !["human", "agent"].includes(action.owner)
        )
          throw new Error("Only agent spaces can change ownership.");
        space.owner = action.owner;
        this.addActivity(
          space.id,
          action.owner === "human"
            ? "You took control. Agent access is paused."
            : "Control returned to the agent.",
          "info",
        );
        break;
      }
      case "space:delete": {
        const space = this.getSpace(action.id);
        if (
          space.kind === "personal" &&
          this.state.spaces.filter((item) => item.kind === "personal").length <=
            1
        )
          throw new Error("Keep at least one personal space.");
        for (const tab of this.state.tabs.filter(
          (item) => item.spaceId === space.id,
        ))
          this.destroyTab(tab.id);
        this.state.tabs = this.state.tabs.filter(
          (item) => item.spaceId !== space.id,
        );
        this.state.spaces = this.state.spaces.filter(
          (item) => item.id !== space.id,
        );
        this.closedTabs = this.closedTabs.filter(
          (item) => item.spaceId !== space.id,
        );
        this.state.activity = this.state.activity.filter(
          (item) => item.spaceId !== space.id,
        );
        if (this.state.activeSpaceId === space.id)
          this.activate(
            this.state.tabs.find(
              (tab) => tab.spaceId === this.state.spaces[0].id,
            )!,
          );
        const oldSession = this.sessionFor(space);
        this.emit();
        try {
          await oldSession.clearStorageData();
          await oldSession.clearCache();
        } finally {
          this.sessionCleanups.get(space.id)?.();
          this.sessionCleanups.delete(space.id);
          this.sessions.delete(space.id);
        }
        break;
      }
      case "bookmark:add": {
        const url = normalizeUrl(
          cleanText(action.url, 8192),
          this.state.settings.searchEngine,
        );
        if (!isWebUrl(url))
          throw new Error("Only web pages can be bookmarked.");
        if (!this.state.bookmarks.some((item) => item.url === url))
          this.state.bookmarks.push({
            id: randomUUID(),
            url,
            title: cleanText(action.title) || url,
            createdAt: Date.now(),
          });
        break;
      }
      case "bookmark:remove":
        this.state.bookmarks = this.state.bookmarks.filter(
          (item) => item.id !== action.id,
        );
        break;
      case "history:clear":
        this.state.history = [];
        break;
      case "settings:update":
        this.state.settings = validSettings(
          action.settings,
          this.state.settings,
        );
        nativeTheme.themeSource = this.state.settings.theme;
        break;
      case "download:show": {
        const download = this.state.downloads.find(
          (item) => item.id === action.id,
        );
        if (download?.path) shell.showItemInFolder(download.path);
        break;
      }
      case "page:find": {
        const text = cleanText(action.text, 1000);
        const contents = this.getWebContents(this.state.activeTabId);
        if (text) {
          contents?.findInPage(text, {
            forward: action.forward !== false,
            findNext:
              this.lastFind.text === text &&
              this.lastFind.tabId === this.state.activeTabId,
          });
          this.lastFind = { text, tabId: this.state.activeTabId };
        } else contents?.stopFindInPage("clearSelection");
        break;
      }
      case "page:stop-find":
        this.getWebContents(this.state.activeTabId)?.stopFindInPage(
          "clearSelection",
        );
        this.lastFind = { text: "", tabId: "" };
        break;
      case "page:zoom": {
        if (!["in", "out", "reset"].includes(action.direction))
          throw new Error("Invalid zoom direction.");
        const contents = this.getWebContents(this.state.activeTabId);
        if (contents)
          contents.setZoomLevel(
            action.direction === "reset"
              ? 0
              : Math.max(
                  -5,
                  Math.min(
                    7,
                    contents.getZoomLevel() +
                      (action.direction === "in" ? 1 : -1),
                  ),
                ),
          );
        break;
      }
      case "page:devtools":
        this.getWebContents(this.state.activeTabId)?.openDevTools({
          mode: "detach",
        });
        break;
      case "page:screenshot": {
        const contents = this.getWebContents(this.state.activeTabId);
        if (contents) {
          const capture = await contents.capturePage();
          const { canceled, filePath } = await dialog.showSaveDialog(
            this.window,
            {
              title: "Save page screenshot",
              defaultPath: join("Grove-screenshot.png"),
              filters: [{ name: "PNG image", extensions: ["png"] }],
            },
          );
          if (!canceled && filePath) {
            await writeFile(filePath, capture.toPNG());
            this.addActivity(
              this.state.activeSpaceId,
              "Page screenshot saved.",
              "success",
            );
          }
        }
        break;
      }
      default:
        throw new Error("Unknown browser action.");
    }
    return this.emit();
  }

  private bindShortcuts(contents: WebContents): void {
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      const key = input.key.toLowerCase();
      const primary =
        process.platform === "darwin" ? input.meta : input.control;
      let shortcut: string | undefined;
      if (primary && !input.alt) {
        if (key === "t") shortcut = input.shift ? "reopen-tab" : "new-tab";
        if (key === "w") shortcut = "close-tab";
        if (key === "l") shortcut = "address";
        if (key === "k") shortcut = "command";
        if (key === "f") shortcut = "find";
        if (key === "d") shortcut = "bookmark";
        if (key === ",") shortcut = "settings";
        if (key === "r") shortcut = "reload";
        if (key === "b") shortcut = "sidebar";
        if (key === "\\") shortcut = "split";
        if (input.shift && key === "]") shortcut = "next-tab";
        if (input.shift && key === "[") shortcut = "previous-tab";
        if (["+", "=", "-", "0"].includes(key)) {
          event.preventDefault();
          void this.dispatch({
            type: "page:zoom",
            direction: key === "0" ? "reset" : key === "-" ? "out" : "in",
          });
          return;
        }
      }
      if (input.control && key === "tab")
        shortcut = input.shift ? "previous-tab" : "next-tab";
      if (key === "f5") shortcut = "reload";
      if (key === "f12") {
        event.preventDefault();
        void this.dispatch({ type: "page:devtools" });
        return;
      }
      if (input.alt && (key === "arrowleft" || key === "arrowright")) {
        event.preventDefault();
        void this.dispatch({
          type: key === "arrowleft" ? "tab:back" : "tab:forward",
          id: this.state.activeTabId,
        });
        return;
      }
      if (primary && !input.shift && (key === "[" || key === "]")) {
        event.preventDefault();
        void this.dispatch({
          type: key === "[" ? "tab:back" : "tab:forward",
          id: this.state.activeTabId,
        });
        return;
      }
      if (shortcut && !this.window.isDestroyed()) {
        event.preventDefault();
        this.window.webContents.focus();
        this.window.webContents.send("grove:shortcut", shortcut);
      }
    });
  }

  dispose(): void {
    if (this.destroyed) return;
    clearTimeout(this.saveTimer);
    this.persist();
    this.destroyed = true;
    for (const id of this.views.keys()) this.destroyTab(id);
    for (const cleanup of this.sessionCleanups.values()) cleanup();
    this.sessionCleanups.clear();
    this.sessions.clear();
    this.listeners.clear();
  }
}
