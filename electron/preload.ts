import { contextBridge, ipcRenderer } from "electron";
import type {
  BrowserAction,
  BrowserState,
  ContentBounds,
  GroveBridge,
} from "../shared/types";

const bridge: GroveBridge = {
  getState: () => ipcRenderer.invoke("grove:state"),
  dispatch: (action: BrowserAction) =>
    ipcRenderer.invoke("grove:dispatch", action),
  subscribe(callback) {
    const listener = (_event: Electron.IpcRendererEvent, state: BrowserState) =>
      callback(state);
    ipcRenderer.on("grove:state-changed", listener);
    return () => ipcRenderer.removeListener("grove:state-changed", listener);
  },
  onShortcut(callback) {
    const listener = (_event: Electron.IpcRendererEvent, shortcut: string) =>
      callback(shortcut);
    ipcRenderer.on("grove:shortcut", listener);
    return () => ipcRenderer.removeListener("grove:shortcut", listener);
  },
  setContentBounds: (bounds: ContentBounds) =>
    ipcRenderer.send("grove:bounds", bounds),
  windowControl: (action) => ipcRenderer.send("grove:window", action),
  getAgentConnection: () => ipcRenderer.invoke("grove:agent-connection"),
};

contextBridge.exposeInMainWorld("grove", bridge);
