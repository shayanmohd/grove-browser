import { describe, expect, it } from "vitest";
import { topSites } from "../shared/topsites";
import type { Bookmark, HistoryEntry } from "../shared/types";

const now = 1_700_000_000_000;
const day = 24 * 60 * 60 * 1000;
const visit = (
  url: string,
  visits: number | undefined,
  daysAgo: number,
): HistoryEntry => ({
  id: url,
  title: url,
  url,
  visitedAt: now - daysAgo * day,
  ...(visits === undefined ? {} : { visits }),
});
const bookmark = (url: string): Bookmark => ({
  id: url,
  title: url,
  url,
  createdAt: 0,
});

describe("top sites", () => {
  it("ranks origins by visits, weighted towards recent ones", () => {
    const sites = topSites(
      [
        visit("https://mail.example/inbox", 40, 200),
        visit("https://docs.example/a", 10, 1),
        visit("https://docs.example/b", 10, 2),
        visit("https://www.shop.example/cart", undefined, 0),
      ],
      [],
      6,
      now,
    );
    expect(sites.map((site) => site.url)).toEqual([
      "https://docs.example/",
      "https://mail.example/",
      "https://www.shop.example/",
    ]);
    expect(sites[2]).toMatchObject({ host: "www.shop.example", title: "shop.example" });
  });
  it("fills up from bookmarks without repeating a site, and respects the limit", () => {
    const sites = topSites(
      [visit("https://github.com/shayanmohd", 3, 1)],
      [
        bookmark("https://github.com"),
        bookmark("https://www.figma.com"),
        bookmark("kamapathy://newtab"),
        bookmark("https://linear.app"),
      ],
      3,
      now,
    );
    expect(sites.map((site) => site.url)).toEqual([
      "https://github.com/",
      "https://www.figma.com/",
      "https://linear.app/",
    ]);
  });
  it("is empty without history or bookmarks", () => {
    expect(topSites([], [], 6, now)).toEqual([]);
  });
});
