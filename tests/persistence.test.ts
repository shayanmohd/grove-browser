import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initialState, newTab } from "../shared/state";
import { readState, writeState } from "../electron/persistence";

const directories: string[] = [];
function statePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "grove-state-test-"));
  directories.push(directory);
  return join(directory, "state.json");
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("desktop session persistence", () => {
  it("restores personal tabs, bookmarks, settings and history with runtime fields reset", () => {
    const path = statePath();
    const original = initialState("darwin");
    const tab = original.tabs[0];
    Object.assign(tab, {
      url: "https://example.com/",
      title: "Example",
      pinned: true,
      loading: true,
      error: "Old network failure",
      canGoBack: true,
    });
    original.history.push({
      id: "visit",
      url: tab.url,
      title: "Example",
      visitedAt: Date.now(),
    });
    original.settings.theme = "dark";
    writeState(path, original);
    const restored = readState(path, "win32", "1.2.3");
    expect(restored.tabs[0]).toMatchObject({
      id: tab.id,
      url: tab.url,
      title: "Example",
      pinned: true,
      loading: false,
      canGoBack: false,
    });
    expect(restored.tabs[0].error).toBeUndefined();
    expect(restored.history).toEqual(original.history);
    expect(restored.bookmarks).toEqual(original.bookmarks);
    expect(restored.settings.theme).toBe("dark");
    expect(restored.platform).toBe("win32");
    expect(restored.version).toBe("1.2.3");
  });

  it("excludes agent tabs, spaces, activity, downloads and runtime connection details from disk", () => {
    const path = statePath();
    const original = initialState("darwin");
    original.spaces.push({
      id: "agent-private",
      name: "Private task",
      kind: "agent",
      owner: "agent",
      color: "purple",
      createdAt: Date.now(),
    });
    const agentTab = newTab("agent-private", "https://private-task.example/");
    original.tabs.push(agentTab);
    original.activeSpaceId = "agent-private";
    original.activeTabId = agentTab.id;
    original.activity.push({
      id: "event",
      spaceId: "agent-private",
      message: "Private task detail",
      kind: "info",
      time: Date.now(),
    });
    original.downloads.push({
      id: "download",
      filename: "secret.txt",
      path: "/tmp/secret.txt",
      receivedBytes: 5,
      totalBytes: 5,
      state: "completed",
    });
    original.automation = { running: true, port: 54321 };
    writeState(path, original);
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toContain("agent-private");
    expect(raw).not.toContain("private-task");
    expect(raw).not.toContain("Private task");
    expect(raw).not.toContain("secret.txt");
    expect(raw).not.toContain("54321");
    const restored = readState(path, "linux", "0.1.0");
    expect(restored.activeSpaceId).toBe("personal");
    expect(
      restored.spaces.some((space) => space.id === restored.activeSpaceId),
    ).toBe(true);
    expect(
      restored.tabs.some(
        (tab) =>
          tab.id === restored.activeTabId &&
          tab.spaceId === restored.activeSpaceId,
      ),
    ).toBe(true);
    expect(restored.automation).toEqual({ running: false, port: null });
  });

  it("starts one blank tab per personal space when session restoration is disabled", () => {
    const path = statePath();
    const original = initialState();
    original.settings.restoreSession = false;
    original.tabs[0].url = "https://example.com/";
    writeState(path, original);
    const restored = readState(path, "linux", "0.1.0");
    expect(restored.tabs).toHaveLength(restored.spaces.length);
    expect(restored.tabs.every((tab) => tab.url === "grove://newtab")).toBe(
      true,
    );
    expect(restored.bookmarks).toEqual(original.bookmarks);
  });

  it("recovers from a missing or incomplete state file", () => {
    const path = statePath();
    expect(readState(path, "linux", "0.1.0").spaces).toHaveLength(2);
    writeFileSync(path, '{"tabs": [');
    const restored = readState(path, "linux", "0.1.0");
    expect(restored.tabs).toHaveLength(2);
    expect(restored.tabs.some((tab) => tab.id === restored.activeTabId)).toBe(
      true,
    );
  });

  it("rejects unsafe restored URLs and invalid settings", () => {
    const path = statePath();
    const original = initialState();
    original.tabs[0].url = "file:///etc/passwd";
    original.tabs[1].url = "https://user:secret@example.com/";
    writeFileSync(
      path,
      JSON.stringify({
        ...original,
        settings: { theme: "invalid", automationEnabled: "yes" },
      }),
    );
    const restored = readState(path, "linux", "0.1.0");
    expect(restored.tabs.every((tab) => tab.url === "grove://newtab")).toBe(
      true,
    );
    expect(restored.settings.theme).toBe("system");
    expect(restored.settings.automationEnabled).toBe(false);
  });
});
