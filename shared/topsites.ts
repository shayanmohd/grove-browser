import type { Bookmark, HistoryEntry } from "./types";
import { isWebUrl } from "./url";

export interface TopSite {
  host: string;
  url: string;
  title: string;
}

const DAY = 24 * 60 * 60 * 1000;

// The sites a person visits most, weighted towards recent visits, filled up
// from bookmarks when history is short. Each site opens at its origin.
export function topSites(
  history: HistoryEntry[],
  bookmarks: Bookmark[],
  limit = 6,
  now = Date.now(),
): TopSite[] {
  const scores = new Map<string, { score: number; url: string }>();
  for (const entry of history) {
    if (!isWebUrl(entry.url)) continue;
    const origin = new URL(entry.url).origin;
    const age = Math.max(0, now - entry.visitedAt) / DAY;
    const score = (entry.visits ?? 1) / (1 + age / 30);
    const current = scores.get(origin);
    if (current) current.score += score;
    else scores.set(origin, { score, url: `${origin}/` });
  }
  const sites = [...scores]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([origin, { url }]) => site(origin, url));
  for (const bookmark of bookmarks) {
    if (sites.length >= limit) break;
    if (!isWebUrl(bookmark.url)) continue;
    const origin = new URL(bookmark.url).origin;
    if (!sites.some((item) => item.url.startsWith(`${origin}/`)))
      sites.push(site(origin, `${origin}/`));
  }
  return sites.slice(0, limit);
}

function site(origin: string, url: string): TopSite {
  const host = new URL(origin).hostname;
  return { host, url, title: host.replace(/^www\./, "") };
}
