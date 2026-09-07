import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { GroveBridge } from "../shared/types";

let storage: Map<string, string>;
let create: () => GroveBridge;
beforeEach(async () => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  create = (await import("../src/lib/bridge")).createPreviewBridge;
});
afterEach(() => vi.unstubAllGlobals());

async function split(bridge: GroveBridge) {
  const first = await bridge.dispatch({
    type: "tab:create",
    url: "https://example.com/first",
  });
  const firstId = first.activeTabId;
  const second = await bridge.dispatch({
    type: "tab:create",
    url: "https://example.com/second",
    background: true,
  });
  const secondId = second.tabs.find((tab) => tab.url.endsWith("/second"))!.id;
  await bridge.dispatch({ type: "tab:split", id: secondId });
  return { firstId, secondId };
}
describe("interactive preview state invariants", () => {
  it("does not expose a previous workspace split after a command palette tab switch", async () => {
    const bridge = create();
    await split(bridge);
    const work = (await bridge.getState()).tabs.find(
      (tab) => tab.spaceId === "work",
    )!;
    const state = await bridge.dispatch({ type: "tab:activate", id: work.id });
    expect(state.activeSpaceId).toBe("work");
    expect(state.splitTabId).toBeNull();
  });
  it("opens duplicate tabs with an honest empty navigation history", async () => {
    const bridge = create();
    let state = await bridge.getState();
    const original = state.activeTabId;
    await bridge.dispatch({
      type: "tab:navigate",
      id: original,
      url: "https://example.com",
    });
    state = await bridge.dispatch({ type: "tab:duplicate", id: original });
    const copy = state.tabs.find((tab) => tab.id === state.activeTabId)!;
    expect(copy.id).not.toBe(original);
    expect(copy.canGoBack).toBe(false);
    expect(copy.canGoForward).toBe(false);
  });
  it("removes split view when opening a fresh new tab or navigating home", async () => {
    const bridge = create();
    await split(bridge);
    expect(
      (await bridge.dispatch({ type: "tab:create" })).splitTabId,
    ).toBeNull();
    const { firstId } = await split(bridge);
    expect(
      (
        await bridge.dispatch({
          type: "tab:navigate",
          id: firstId,
          url: "grove://newtab",
        })
      ).splitTabId,
    ).toBeNull();
  });
  it("promotes the surviving pane when the primary split tab is closed", async () => {
    const bridge = create();
    const { firstId, secondId } = await split(bridge);
    const state = await bridge.dispatch({ type: "tab:close", id: firstId });
    expect(state.activeTabId).toBe(secondId);
    expect(state.splitTabId).toBeNull();
  });
  it("clears split when back reaches Home or the secondary pane navigates Home", async () => {
    const bridge = create();
    const original = (await bridge.getState()).activeTabId;
    await bridge.dispatch({
      type: "tab:navigate",
      id: original,
      url: "https://example.com",
    });
    const other = await bridge.dispatch({
      type: "tab:create",
      url: "https://example.com/other",
      background: true,
    });
    const second = other.tabs.find((tab) => tab.url.endsWith("/other"))!.id;
    await bridge.dispatch({ type: "tab:split", id: second });
    expect(
      (await bridge.dispatch({ type: "tab:back", id: original })).splitTabId,
    ).toBeNull();
    const { secondId } = await split(bridge);
    expect(
      (
        await bridge.dispatch({
          type: "tab:navigate",
          id: secondId,
          url: "grove://newtab",
        })
      ).splitTabId,
    ).toBeNull();
  });
  it("does not persist agent spaces or fake restored history controls", async () => {
    const bridge = create();
    const original = (await bridge.getState()).activeTabId;
    await bridge.dispatch({
      type: "tab:navigate",
      id: original,
      url: "https://example.com",
    });
    await bridge.dispatch({
      type: "space:create",
      name: "Private task",
      color: "purple",
      kind: "agent",
    });
    const saved = JSON.parse(storage.get("grove-preview-v1")!);
    expect(
      saved.spaces.every(
        (space: { kind: string }) => space.kind === "personal",
      ),
    ).toBe(true);
    const state = await create().getState();
    expect(state.spaces.some((space) => space.kind === "agent")).toBe(false);
    expect(state.tabs.every((tab) => !tab.canGoBack && !tab.canGoForward)).toBe(
      true,
    );
  });
  it("respects a disabled session restore preference", async () => {
    const bridge = create();
    await bridge.dispatch({ type: "tab:create", url: "https://example.com" });
    await bridge.dispatch({
      type: "settings:update",
      settings: { restoreSession: false },
    });
    expect(
      (await create().getState()).tabs.every(
        (tab) => tab.url === "grove://newtab",
      ),
    ).toBe(true);
  });
});
