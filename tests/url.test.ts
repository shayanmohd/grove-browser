import { describe, expect, it } from "vitest";
import { HOME_URL } from "../shared/state";
import { hostname, isWebUrl, normalizeUrl } from "../shared/url";

describe("address bar normalization", () => {
  it.each(["", "   ", HOME_URL])(
    "returns the internal new tab page for %j",
    (input) => {
      expect(normalizeUrl(input)).toBe(HOME_URL);
    },
  );

  it.each([
    [" example.com ", "https://example.com/"],
    ["example.com:8443/docs", "https://example.com:8443/docs"],
    [
      "https://EXAMPLE.com/docs?q=one#two",
      "https://example.com/docs?q=one#two",
    ],
    ["http://example.com", "http://example.com/"],
    ["localhost", "http://localhost/"],
    ["localhost:5173/docs", "http://localhost:5173/docs"],
    ["127.0.0.1:3000", "http://127.0.0.1:3000/"],
    ["[::1]:8080/test", "http://[::1]:8080/test"],
    ["localhost:5173?debug=1", "http://localhost:5173/?debug=1"],
    ["localhost#section", "http://localhost/#section"],
    ["127.0.0.1:3000?debug=1", "http://127.0.0.1:3000/?debug=1"],
    ["[::1]:8080#section", "http://[::1]:8080/#section"],
    ["example.com:8443?debug=1", "https://example.com:8443/?debug=1"],
  ])("normalizes %s without losing the destination", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it.each([
    ["duckduckgo", "https://duckduckgo.com/?q="],
    ["google", "https://www.google.com/search?q="],
    ["bing", "https://www.bing.com/search?q="],
  ] as const)("encodes a complete search query for %s", (engine, base) => {
    expect(normalizeUrl("  trees & trails / nearby?  ", engine)).toBe(
      `${base}trees%20%26%20trails%20%2F%20nearby%3F`,
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "mailto:someone@example.com",
    "chrome://settings",
    "grove://settings",
  ])("rejects unsupported navigation scheme %s", (input) => {
    expect(() => normalizeUrl(input)).toThrow(
      "Only HTTP and HTTPS addresses are supported.",
    );
  });

  it.each([
    "https://user:secret@example.com",
    "http://user@example.com",
    "https://trusted.example@other.example",
    "trusted.example@other.example",
    "user@example.com",
  ])("rejects credentials and ambiguous authority in %s", (input) => {
    expect(() => normalizeUrl(input)).toThrow(
      "URLs containing credentials are not supported.",
    );
  });

  it.each(["https://", "http://[invalid]", "https://example.com:99999"])(
    "rejects malformed URL %s",
    (input) => {
      expect(() => normalizeUrl(input)).toThrow();
    },
  );
});

describe("remote page URL validation", () => {
  it.each([
    "https://example.com/",
    "http://localhost:8080",
    "http://[::1]:3000",
  ])("permits HTTP browsing at %s", (url) => {
    expect(isWebUrl(url)).toBe(true);
  });

  it.each([
    HOME_URL,
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/index.html",
    "https://user:secret@example.com",
    "https://user@example.com",
    "example.com",
    "http://",
  ])("does not treat %s as a permitted remote page", (url) => {
    expect(isWebUrl(url)).toBe(false);
  });
});

describe("hostname labels", () => {
  it("strips only a leading www label and preserves meaningful subdomains", () => {
    expect(hostname("https://www.example.com/a?q=b")).toBe("example.com");
    expect(hostname("https://docs.example.com")).toBe("docs.example.com");
  });

  it("keeps an unparseable label readable", () => {
    expect(hostname("New tab")).toBe("New tab");
  });
});
