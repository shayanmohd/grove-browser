import { HOME_URL } from "./state";
import type { Settings } from "./types";

export function normalizeUrl(
  input: string,
  engine: Settings["searchEngine"] = "duckduckgo",
): string {
  const value = input.trim();
  if (!value || value === HOME_URL) return HOME_URL;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.username || url.password)
      throw new Error("URLs containing credentials are not supported.");
    return url.href;
  }
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#]|$)/i.test(value))
    return new URL(`http://${value}`).href;
  if (
    /^[a-z][a-z\d+.-]*:/i.test(value) &&
    !/^[^\s/:]+\.\w+:\d+([/?#]|$)/.test(value)
  )
    throw new Error("Only HTTP and HTTPS addresses are supported.");
  if (/^[^\s/]+\.[^\s/.]+(:\d+)?(\/[^\s]*)?$/.test(value)) {
    const url = new URL(`https://${value}`);
    if (url.username || url.password)
      throw new Error("URLs containing credentials are not supported.");
    return url.href;
  }
  const bases = {
    duckduckgo: "https://duckduckgo.com/?q=",
    google: "https://www.google.com/search?q=",
    bing: "https://www.bing.com/search?q=",
  };
  return bases[engine] + encodeURIComponent(value);
}
export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
export function isWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}
