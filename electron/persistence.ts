import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { initialState, newTab } from "../shared/state";
import { isWebUrl } from "../shared/url";
import type { BrowserState, Settings, Space } from "../shared/types";

export function validSettings(value: unknown, base: Settings): Settings {
  if (!value || typeof value !== "object") return base;
  const settings = value as Partial<Settings>;
  return {
    theme: ["system", "light", "dark"].includes(settings.theme ?? "")
      ? settings.theme!
      : base.theme,
    searchEngine: ["duckduckgo", "google", "bing"].includes(
      settings.searchEngine ?? "",
    )
      ? settings.searchEngine!
      : base.searchEngine,
    restoreSession:
      typeof settings.restoreSession === "boolean"
        ? settings.restoreSession
        : base.restoreSession,
    showBookmarksBar:
      typeof settings.showBookmarksBar === "boolean"
        ? settings.showBookmarksBar
        : base.showBookmarksBar,
    automationEnabled:
      typeof settings.automationEnabled === "boolean"
        ? settings.automationEnabled
        : base.automationEnabled,
  };
}

export function readState(
  path: string,
  platform: BrowserState["platform"],
  version: string,
): BrowserState {
  const state = initialState(platform);
  state.version = version;
  try {
    const saved = JSON.parse(
      readFileSync(path, "utf8"),
    ) as Partial<BrowserState>;
    state.settings = validSettings(saved.settings, state.settings);
    const spaces = Array.isArray(saved.spaces)
      ? saved.spaces
          .filter(
            (space): space is Space =>
              !!space &&
              typeof space.id === "string" &&
              /^[a-z\d-]{1,80}$/i.test(space.id) &&
              typeof space.name === "string" &&
              space.name.length > 0 &&
              space.name.length <= 48 &&
              space.kind === "personal" &&
              ["green", "blue", "orange", "purple"].includes(space.color),
          )
          .map((space) => ({ ...space, owner: "human" as const }))
      : [];
    if (spaces.length) state.spaces = spaces.slice(0, 30);
    state.tabs = state.spaces.map((space) => newTab(space.id));
    if (state.settings.restoreSession && Array.isArray(saved.tabs)) {
      const restored = saved.tabs
        .filter(
          (tab) =>
            tab &&
            typeof tab.id === "string" &&
            state.spaces.some((space) => space.id === tab.spaceId) &&
            typeof tab.title === "string" &&
            (tab.url === "grove://newtab" || isWebUrl(tab.url)),
        )
        .slice(0, 200);
      if (restored.length)
        state.tabs = restored.map((tab) => ({
          ...newTab(tab.spaceId, tab.url),
          id: tab.id,
          title: tab.title.slice(0, 300),
          pinned: !!tab.pinned,
        }));
      for (const space of state.spaces)
        if (!state.tabs.some((tab) => tab.spaceId === space.id))
          state.tabs.push(newTab(space.id));
    }
    state.activeSpaceId = state.spaces.some(
      (space) => space.id === saved.activeSpaceId,
    )
      ? saved.activeSpaceId!
      : state.spaces[0].id;
    state.activeTabId = state.tabs.some(
      (tab) =>
        tab.id === saved.activeTabId && tab.spaceId === state.activeSpaceId,
    )
      ? saved.activeTabId!
      : state.tabs.find((tab) => tab.spaceId === state.activeSpaceId)!.id;
    if (Array.isArray(saved.bookmarks))
      state.bookmarks = saved.bookmarks
        .filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            isWebUrl(item.url),
        )
        .slice(0, 1000);
    if (Array.isArray(saved.history))
      state.history = saved.history
        .filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            Number.isFinite(item.visitedAt) &&
            isWebUrl(item.url),
        )
        .slice(0, 1000);
  } catch {
    // A missing or incomplete state file starts a usable, fresh session.
  }
  return state;
}

export function writeState(path: string, state: BrowserState): void {
  const spaces = state.spaces.filter((space) => space.kind === "personal");
  const ids = new Set(spaces.map((space) => space.id));
  const tabs = state.tabs.filter((tab) => ids.has(tab.spaceId));
  const activeSpaceId = ids.has(state.activeSpaceId)
    ? state.activeSpaceId
    : spaces[0]?.id;
  const activeTabId =
    tabs.find((tab) => tab.id === state.activeTabId)?.id ??
    tabs.find((tab) => tab.spaceId === activeSpaceId)?.id;
  const payload = {
    spaces,
    tabs,
    activeSpaceId,
    activeTabId,
    bookmarks: state.bookmarks,
    history: state.history,
    settings: state.settings,
  };
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporary, path);
}
