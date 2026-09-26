import { contextBridge, ipcRenderer } from "electron";
import type {
  BrowserAction,
  BrowserState,
  ContentBounds,
  KamapathyBridge,
} from "../shared/types";

const bridge: KamapathyBridge = {
  getState: () => ipcRenderer.invoke("kamapathy:state"),
  dispatch: (action: BrowserAction) =>
    ipcRenderer.invoke("kamapathy:dispatch", action),
  subscribe(callback) {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) =>
      callback(state);
    ipcRenderer.on("kamapathy:state-changed", listener);
    return () => ipcRenderer.removeListener("kamapathy:state-changed", listener);
  },
  onShortcut(callback) {
    const listener = (_event: Electron.IpcRendererEvent, shortcut: string) =>
      callback(shortcut);
    ipcRenderer.on("kamapathy:shortcut", listener);
    return () => ipcRenderer.removeListener("kamapathy:shortcut", listener);
  },
  setContentBounds: (bounds: ContentBounds) =>
    ipcRenderer.send("kamapathy:bounds", bounds),
  freeze: () => ipcRenderer.invoke("kamapathy:freeze"),
  hidePages: () => ipcRenderer.send("kamapathy:hide-pages"),
  unfreeze: () => ipcRenderer.invoke("kamapathy:unfreeze"),
  thumbnails: () => ipcRenderer.invoke("kamapathy:thumbnails"),
  windowControl: (action) => ipcRenderer.send("kamapathy:window", action),
  importSources: () => ipcRenderer.invoke("kamapathy:import-sources"),
  importBrowserData: (request) =>
    ipcRenderer.invoke("kamapathy:import", request),
};

contextBridge.exposeInMainWorld("kamapathy", bridge);
