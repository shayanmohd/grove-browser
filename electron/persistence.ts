import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { restoreState } from "../shared/restore";
import type { BrowserState } from "../shared/types";
export { validSettings } from "../shared/restore";

export function readState(
  path: string,
  platform: BrowserState["platform"],
  version: string,
): BrowserState {
  let saved: unknown;
  try {
    saved = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    /* Start fresh. */
  }
  return restoreState(saved, platform, version);
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
