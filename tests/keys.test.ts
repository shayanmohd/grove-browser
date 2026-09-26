import { describe, expect, it } from "vitest";
import { keyAction, keyLabel, type KeyInput } from "../src/lib/keys";

const press = (key: string, modifiers: Partial<KeyInput> = {}): KeyInput => ({
  key,
  code: `Key${key.toUpperCase()}`,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("window shortcuts", () => {
  it.each([
    [press("y", { metaKey: true }), "history"],
    [press("B", { metaKey: true, shiftKey: true }), "bookmarks"],
    [press("J", { ctrlKey: true, shiftKey: true }), "downloads"],
    [press("T", { metaKey: true, shiftKey: true }), "reopen-tab"],
    [press("d", { ctrlKey: true }), "bookmark"],
    [press(",", { metaKey: true }), "settings"],
    [press("Tab", { ctrlKey: true, shiftKey: true }), "previous-tab"],
  ])("maps %j to %s", (input, name) => {
    expect(keyAction(input)).toBe(name);
  });
  it("leaves other keys to the page", () => {
    expect(keyAction(press("j", { metaKey: true }))).toBeUndefined();
    expect(keyAction(press("y"))).toBeUndefined();
    expect(keyAction(press("k", { metaKey: true, altKey: true }))).toBeUndefined();
  });
  it("has no sidebar shortcut", () => {
    expect(keyAction(press("b", { metaKey: true }))).toBeUndefined();
  });
  it("toggles the spaces grid with Option+S by physical key", () => {
    expect(keyAction({ ...press("ß", { altKey: true }), code: "KeyS" })).toBe("spaces");
    expect(
      keyAction({ ...press("s", { altKey: true, metaKey: true }), code: "KeyS" }),
    ).toBeUndefined();
  });
  it("leaves Option+S to text fields", () => {
    expect(
      keyAction({
        ...press("ß", { altKey: true }),
        code: "KeyS",
        target: { tagName: "INPUT" },
      }),
    ).toBeUndefined();
  });
  it("opens History with Ctrl+H off macOS and leaves Ctrl+Y to redo", () => {
    expect(keyAction(press("h", { ctrlKey: true }), false)).toBe("history");
    expect(keyAction(press("y", { ctrlKey: true }), false)).toBeUndefined();
    expect(keyAction(press("y", { metaKey: true }), true)).toBe("history");
  });
});

describe("shortcut labels", () => {
  it("uses symbols on macOS and words elsewhere", () => {
    expect(keyLabel(true, "mod+shift+b")).toBe("⇧⌘B");
    expect(keyLabel(false, "mod+shift+b")).toBe("Ctrl+Shift+B");
    expect(keyLabel(true, "alt+s")).toBe("⌥S");
    expect(keyLabel(false, "alt+s")).toBe("Alt+S");
    expect(keyLabel(true, "mod+,")).toBe("⌘,");
  });
});
