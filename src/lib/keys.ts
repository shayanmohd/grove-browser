import type { ActionName } from "./actions";

export interface KeyInput {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target?: unknown;
}

const withModifier: Partial<Record<string, ActionName>> = {
  k: "command",
  l: "address",
  w: "close-tab",
  f: "find",
  r: "reload",
  ",": "settings",
  d: "bookmark",
};

function typing(target: unknown): boolean {
  const element = target as
    | { tagName?: string; isContentEditable?: boolean }
    | null
    | undefined;
  return (
    !!element &&
    (element.isContentEditable === true ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName ?? ""))
  );
}

// The desktop menu takes most of these keys first, and this covers the web
// preview. Option+S has no menu key, so the desktop app relies on this for it.
export function keyAction(
  event: KeyInput,
  mac = true,
): ActionName | undefined {
  // Option+S types "ß" on macOS, so match the physical key.
  if (event.altKey && !event.metaKey && !event.ctrlKey && event.code === "KeyS")
    return typing(event.target) ? undefined : "spaces";
  const key = event.key.toLowerCase();
  if (event.ctrlKey && key === "tab")
    return event.shiftKey ? "previous-tab" : "next-tab";
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return undefined;
  if (key === "t") return event.shiftKey ? "reopen-tab" : "new-tab";
  if (key === "b" && event.shiftKey) return "bookmarks";
  if (key === "j") return event.shiftKey ? "downloads" : undefined;
  if (key === (mac ? "y" : "h")) return "history";
  return withModifier[key];
}

export function keyLabel(mac: boolean, combo: string): string {
  const parts = combo.split("+");
  const key = parts.pop()!.toUpperCase();
  const has = (name: string) => parts.includes(name);
  if (mac)
    return `${has("alt") ? "⌥" : ""}${has("shift") ? "⇧" : ""}${has("mod") ? "⌘" : ""}${key}`;
  return [has("mod") && "Ctrl", has("shift") && "Shift", has("alt") && "Alt", key]
    .filter(Boolean)
    .join("+");
}
