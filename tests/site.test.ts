import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const site = (file: string) =>
  readFileSync(new URL(`../site/${file}`, import.meta.url), "utf8");
const stamp = (file: string) =>
  createHash("sha256").update(site(file)).digest("hex").slice(0, 10);

// Cloudflare keeps CSS and JS for hours, so each page links them with a hash
// of their contents and a changed file gets a URL no cache has seen.
describe("website asset links", () => {
  for (const page of ["index.html", "404.html"])
    it(`${page} links the current styles and scripts`, () => {
      const html = site(page);
      const links = [...html.matchAll(/(?:href|src)="\/([\w-]+\.(?:css|js))(\?v=[\w]+)?"/g)];
      expect(links.length).toBeGreaterThan(0);
      for (const [, file, version] of links)
        expect(`${file}${version ?? ""}`).toBe(`${file}?v=${stamp(file)}`);
    });
});
