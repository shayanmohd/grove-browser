export type Theme = "system" | "light" | "dark";
export type SpaceColor = "green" | "blue" | "orange" | "purple";
export interface Space {
  id: string;
  name: string;
  color: SpaceColor;
  kind: "personal" | "agent";
  owner: "human" | "agent";
  createdAt: number;
}
export interface Tab {
  id: string;
  spaceId: string;
  title: string;
  url: string;
  favicon?: string;
  pinned: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error?: string;
}
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}
export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}
export interface Download {
  id: string;
  filename: string;
  receivedBytes: number;
  totalBytes: number;
  state: "progressing" | "completed" | "cancelled" | "interrupted";
  path: string;
}
export interface Activity {
  id: string;
  spaceId?: string;
  message: string;
  time: number;
  kind: "info" | "success" | "warning";
}
export interface Settings {
  theme: Theme;
  searchEngine: "duckduckgo" | "google" | "bing";
  restoreSession: boolean;
  showBookmarksBar: boolean;
  automationEnabled: boolean;
}
export interface BrowserState {
  spaces: Space[];
  tabs: Tab[];
  activeSpaceId: string;
  activeTabId: string;
  splitTabId: string | null;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  downloads: Download[];
  activity: Activity[];
  settings: Settings;
  platform: "darwin" | "win32" | "linux" | "web";
  version: string;
  automation: { running: boolean; port: number | null };
}
export type BrowserAction =
  | { type: "tab:create"; url?: string; spaceId?: string; background?: boolean }
  | { type: "tab:close"; id: string }
  | { type: "tab:activate"; id: string }
  | { type: "tab:navigate"; id: string; url: string }
  | {
      type:
        | "tab:back"
        | "tab:forward"
        | "tab:reload"
        | "tab:stop"
        | "tab:pin"
        | "tab:duplicate";
      id: string;
    }
  | { type: "tab:reopen" }
  | { type: "tab:split"; id: string | null }
  | {
      type: "space:create";
      name: string;
      color: SpaceColor;
      kind: "personal" | "agent";
    }
  | { type: "space:activate"; id: string }
  | { type: "space:rename"; id: string; name: string }
  | { type: "space:delete"; id: string }
  | { type: "space:ownership"; id: string; owner: "human" | "agent" }
  | { type: "bookmark:add"; url: string; title: string }
  | { type: "bookmark:remove"; id: string }
  | { type: "history:clear" }
  | { type: "settings:update"; settings: Partial<Settings> }
  | { type: "download:show"; id: string }
  | { type: "page:find"; text: string; forward?: boolean }
  | { type: "page:stop-find" }
  | { type: "page:zoom"; direction: "in" | "out" | "reset" }
  | { type: "page:devtools" }
  | { type: "page:screenshot" };
export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  hidden: boolean;
}
export interface AgentConnection {
  endpoint: string;
  token: string;
}
export interface GroveBridge {
  getState(): Promise<BrowserState>;
  dispatch(action: BrowserAction): Promise<BrowserState>;
  subscribe(callback: (state: BrowserState) => void): () => void;
  onShortcut(callback: (shortcut: string) => void): () => void;
  setContentBounds(bounds: ContentBounds): void;
  windowControl(action: "minimize" | "maximize" | "close"): void;
  getAgentConnection(): Promise<AgentConnection | null>;
}
