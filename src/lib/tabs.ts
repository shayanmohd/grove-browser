import type { BrowserState, Tab } from "../../shared/types";

export function spaceTabs(
  state: Pick<BrowserState, "tabs" | "activeSpaceId">,
): Tab[] {
  const tabs = state.tabs.filter((tab) => tab.spaceId === state.activeSpaceId);
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)];
}

export function filterTabs(tabs: Tab[], query: string): Tab[] {
  const needle = query.trim().toLowerCase();
  return needle
    ? tabs.filter((tab) =>
        `${tab.title} ${tab.url}`.toLowerCase().includes(needle),
      )
    : tabs;
}
