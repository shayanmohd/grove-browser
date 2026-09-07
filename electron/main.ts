import { app, BrowserWindow, ipcMain, Menu, session } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BrowserController } from "./controller";
import { readState } from "./persistence";
import { startAutomation } from "./automation";
import { isWebUrl } from "../shared/url";
import { version } from "../package.json";
import type {
  AgentConnection,
  BrowserAction,
  BrowserState,
  ContentBounds,
} from "../shared/types";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
if (process.env.GROVE_USER_DATA)
  app.setPath("userData", resolve(process.env.GROVE_USER_DATA));
app.setName("Grove");

let window: BrowserWindow | null = null;
let controller: BrowserController | null = null;
let automation: Awaited<ReturnType<typeof startAutomation>> | null = null;
let automationSyncing = false;
let quitting = false;
const rendererFile = join(moduleDirectory, "../renderer/index.html");
const developmentUrl = !app.isPackaged
  ? process.env.ELECTRON_RENDERER_URL
  : undefined;
const rendererUrl = developmentUrl || pathToFileURL(rendererFile).href;

function trustedUrl(url: string): boolean {
  try {
    const actual = new URL(url);
    const expected = new URL(rendererUrl);
    return (
      actual.origin === expected.origin &&
      actual.protocol === expected.protocol &&
      actual.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

function validateSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
): BrowserController {
  if (
    !window ||
    !controller ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    !event.senderFrame ||
    event.senderFrame !== window.webContents.mainFrame ||
    !trustedUrl(event.senderFrame.url)
  )
    throw new Error(
      "This operation is available only to the browser interface.",
    );
  return controller;
}

async function syncAutomation(): Promise<void> {
  if (automationSyncing) return;
  automationSyncing = true;
  try {
    while (
      Boolean(controller?.state.settings.automationEnabled && !quitting) !==
      Boolean(automation)
    ) {
      if (controller?.state.settings.automationEnabled && !quitting) {
        const owner = controller;
        try {
          automation = await startAutomation(owner);
          if (owner === controller) owner.setAutomation(true, automation.port);
          else {
            await automation.close();
            automation = null;
          }
        } catch (error) {
          if (owner === controller) {
            owner.addActivity(
              undefined,
              "The local agent service could not start. Check that loopback networking is available.",
              "warning",
            );
            await owner.dispatch({
              type: "settings:update",
              settings: { automationEnabled: false },
            });
          }
          console.error(
            "Agent service startup failed:",
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      } else if (automation) {
        const closing = automation;
        automation = null;
        await closing.close();
        controller?.setAutomation(false, null);
      }
    }
  } finally {
    automationSyncing = false;
  }
}

function shortcut(name: string): void {
  if (window && !window.isDestroyed()) {
    window.webContents.focus();
    window.webContents.send("grove:shortcut", name);
  }
}

function createWindow(): void {
  const platform: BrowserState["platform"] =
    process.platform === "darwin"
      ? "darwin"
      : process.platform === "win32"
        ? "win32"
        : "linux";
  const statePath = join(app.getPath("userData"), "browser-state.json");
  const state = readState(statePath, platform, version);
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, "icon.png")
    : resolve("build/icon.png");
  window = new BrowserWindow({
    title: "Grove",
    width: 1440,
    height: 960,
    minWidth: 850,
    minHeight: 600,
    show: false,
    backgroundColor: state.settings.theme === "dark" ? "#171b19" : "#f6f7f3",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 20, y: 20 } : undefined,
    frame: process.platform === "darwin",
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(moduleDirectory, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  const currentWindow = window;
  controller = new BrowserController(currentWindow, state, statePath);
  const currentController = controller;
  currentController.subscribe(() => {
    void syncAutomation();
  });
  currentWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  currentWindow.webContents.on("will-navigate", (event, url) => {
    if (!trustedUrl(url)) event.preventDefault();
  });
  currentWindow.webContents.on("will-redirect", (event) =>
    event.preventDefault(),
  );
  currentWindow.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  currentWindow.once("ready-to-show", () => currentWindow.show());
  currentWindow.on("close", () => currentController.dispose());
  currentWindow.on("closed", () => {
    if (window === currentWindow) {
      window = null;
      controller = null;
    }
    void syncAutomation();
  });
  void (developmentUrl
    ? currentWindow.loadURL(developmentUrl)
    : currentWindow.loadFile(rendererFile));
  void syncAutomation();
}

function registerIpc(): void {
  ipcMain.handle("grove:state", (event) => validateSender(event).state);
  ipcMain.handle("grove:dispatch", async (event, action: BrowserAction) => {
    const owner = validateSender(event);
    if (
      action?.type === "space:ownership" &&
      action.owner === "agent" &&
      !automation
    )
      throw new Error(
        "Turn on the agent connection before letting an agent continue.",
      );
    const state = await owner.dispatch(action);
    if (action?.type === "space:ownership" && action.owner === "agent") {
      try {
        if (!automation)
          throw new Error(
            "The agent connection stopped. Turn it on before continuing.",
          );
        automation.grantSpace(action.id);
      } catch (error) {
        await owner.dispatch({
          type: "space:ownership",
          id: action.id,
          owner: "human",
        });
        throw error;
      }
    }
    return state;
  });
  ipcMain.handle("grove:agent-connection", (event): AgentConnection | null => {
    validateSender(event);
    return automation
      ? {
          endpoint: `http://127.0.0.1:${automation.port}`,
          token: automation.token,
        }
      : null;
  });
  ipcMain.on("grove:bounds", (event, bounds: ContentBounds) => {
    try {
      validateSender(event).setContentBounds(bounds);
    } catch {
      /* Untrusted frames have no native window access. */
    }
  });
  ipcMain.on("grove:window", (event, action: string) => {
    try {
      const current = validateSender(event).window;
      if (action === "minimize") current.minimize();
      if (action === "maximize") {
        if (current.isMaximized()) current.unmaximize();
        else current.maximize();
      }
      if (action === "close") current.close();
    } catch {
      /* Ignore messages from untrusted frames. */
    }
  });
}

function installMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
    {
      label: "File",
      submenu: [
        { label: "New Tab", click: () => shortcut("new-tab") },
        { label: "Reopen Closed Tab", click: () => shortcut("reopen-tab") },
        { label: "Close Tab", click: () => shortcut("close-tab") },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Command Palette", click: () => shortcut("command") },
        { label: "Toggle Sidebar", click: () => shortcut("sidebar") },
        { label: "Split View", click: () => shortcut("split") },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    if (!window) createWindow();
    if (window?.isMinimized()) window.restore();
    window?.focus();
    const url = argv.find((argument) => isWebUrl(argument));
    if (url) void controller?.dispatch({ type: "tab:create", url });
  });
  app.on("before-quit", () => {
    quitting = true;
    controller?.dispose();
    void syncAutomation();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (!window) createWindow();
    else window.show();
  });
  void app.whenReady().then(() => {
    const canWriteClipboard = (
      contents: Electron.WebContents | null,
      permission: string,
    ) =>
      permission === "clipboard-sanitized-write" &&
      !!window &&
      contents === window.webContents &&
      trustedUrl(contents.getURL());
    session.defaultSession.setPermissionRequestHandler(
      (contents, permission, callback) =>
        callback(canWriteClipboard(contents, permission)),
    );
    session.defaultSession.setPermissionCheckHandler((contents, permission) =>
      canWriteClipboard(contents, permission),
    );
    registerIpc();
    installMenu();
    createWindow();
  });
}
