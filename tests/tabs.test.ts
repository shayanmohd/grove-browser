import { describe, expect, it } from "vitest";
import { initialState, newTab } from "../shared/state";
import { filterTabs, spaceTabs } from "../src/lib/tabs";

describe("tab strip order", () => {
  it("lists only the current space with pinned tabs first", () => {
    const state = initialState();
    const [home] = state.tabs;
    const docs = { ...newTab("personal", "https://developer.mozilla.org/"), title: "MDN" };
    const pinned = { ...newTab("personal", "https://github.com/"), title: "GitHub", pinned: true };
    state.tabs.push(docs, pinned);
    expect(spaceTabs(state).map((tab) => tab.id)).toEqual([pinned.id, home.id, docs.id]);
  });
  it("filters by title or address, ignoring case and surrounding spaces", () => {
    const tabs = [
      { ...newTab("personal", "https://github.com/"), title: "GitHub" },
      { ...newTab("personal", "https://developer.mozilla.org/"), title: "MDN" },
    ];
    expect(filterTabs(tabs, " mozilla ").map((tab) => tab.title)).toEqual(["MDN"]);
    expect(filterTabs(tabs, "GIT").map((tab) => tab.title)).toEqual(["GitHub"]);
    expect(filterTabs(tabs, "")).toHaveLength(2);
  });
});
