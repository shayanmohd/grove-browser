import type { BrowserState, Tab } from "./types";

export const HOME_URL = "grove://newtab";
export const id = () => globalThis.crypto.randomUUID();
export function newTab(spaceId: string, url = HOME_URL): Tab {
  return {
    id: id(),
    spaceId,
    url,
    title: url === HOME_URL ? "New tab" : url,
    pinned: false,
    loading: false,
    canGoBack: false,
    canGoForward: false,
  };
}
export function initialState(
  platform: BrowserState["platform"] = "web",
): BrowserState {
  const now = Date.now();
  const tab = newTab("personal");
  return {
    spaces: [
      {
        id: "personal",
        name: "Personal",
        color: "green",
        kind: "personal",
        owner: "human",
        createdAt: now,
      },
      {
        id: "work",
        name: "Work",
        color: "blue",
        kind: "personal",
        owner: "human",
        createdAt: now,
      },
    ],
    tabs: [tab, newTab("work")],
    activeSpaceId: "personal",
    activeTabId: tab.id,
    splitTabId: null,
    bookmarks: [
      {
        id: "github",
        title: "GitHub",
        url: "https://github.com",
        createdAt: now,
      },
      {
        id: "figma",
        title: "Figma",
        url: "https://www.figma.com",
        createdAt: now,
      },
      {
        id: "linear",
        title: "Linear",
        url: "https://linear.app",
        createdAt: now,
      },
      {
        id: "notion",
        title: "Notion",
        url: "https://www.notion.so",
        createdAt: now,
      },
      {
        id: "youtube",
        title: "YouTube",
        url: "https://www.youtube.com",
        createdAt: now,
      },
    ],
    history: [],
    downloads: [],
    activity: [],
    settings: {
      theme: "system",
      searchEngine: "duckduckgo",
      restoreSession: true,
      showBookmarksBar: false,
      automationEnabled: false,
    },
    platform,
    version: "0.1.0",
    automation: { running: false, port: null },
  };
}
