import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  availableBrowsers,
  chromiumTime,
  defaultBrowser,
  firefoxTime,
  importFrom,
  parseChromiumBookmarks,
  parseSafariBookmarks,
  safariTime,
  type BrowserId,
  type ImportEnv,
} from "../electron/import";

const fixtures = fileURLToPath(new URL("./fixtures/import/", import.meta.url));
const directories: string[] = [];
function folder(): string {
  const directory = mkdtempSync(join(tmpdir(), "kamapathy-browser-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function write(path: string, text = "") {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
function place(fixture: string, destination: string) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(fixtures, fixture), destination);
}
const fixtureJson = (fixture: string): unknown =>
  JSON.parse(readFileSync(join(fixtures, fixture), "utf8"));
const silent: ImportEnv["exec"] = () => "";
const failing: ImportEnv["exec"] = () => {
  throw new Error("command failed");
};
const mac = (home: string, exec: ImportEnv["exec"] = silent): ImportEnv => ({
  platform: "darwin",
  home,
  exec,
});
const support = (home: string) => join(home, "Library", "Application Support");
const both = { bookmarks: true, history: true };

const launchServices = (handler?: Record<string, unknown>) =>
  JSON.stringify({
    LSHandlers: [
      { LSHandlerContentType: "public.html", LSHandlerRoleAll: "com.apple.safari" },
      ...(handler ? [handler] : []),
    ],
  });
const registry = (progId: string) =>
  `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice\r\n    ProgId    REG_SZ    ${progId}\r\n\r\n`;

function chromiumHistory(
  path: string,
  rows: [string, string | null, number, number, number][],
): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE urls(id INTEGER PRIMARY KEY AUTOINCREMENT, url LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER DEFAULT 0 NOT NULL, typed_count INTEGER DEFAULT 0 NOT NULL, last_visit_time INTEGER NOT NULL, hidden INTEGER DEFAULT 0 NOT NULL)",
  );
  const insert = db.prepare(
    "INSERT INTO urls (url, title, visit_count, last_visit_time, hidden) VALUES (?, ?, ?, ?, ?)",
  );
  // One transaction: a thousand separate commits take seconds on Windows.
  db.exec("BEGIN");
  for (const row of rows) insert.run(...row);
  db.exec("COMMIT");
  return db;
}

function firefoxPlaces(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR, rev_host LONGVARCHAR, visit_count INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0 NOT NULL, typed INTEGER DEFAULT 0 NOT NULL, frecency INTEGER DEFAULT -1 NOT NULL, last_visit_date INTEGER, guid TEXT, foreign_count INTEGER DEFAULT 0 NOT NULL, url_hash INTEGER DEFAULT 0 NOT NULL, description TEXT, preview_image_url TEXT, site_name TEXT, origin_id INTEGER, recalc_frecency INTEGER NOT NULL DEFAULT 0, alt_frecency INTEGER, recalc_alt_frecency INTEGER NOT NULL DEFAULT 0)",
  );
  db.exec(
    "CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER DEFAULT NULL, parent INTEGER, position INTEGER, title LONGVARCHAR, keyword_id INTEGER, folder_type TEXT, dateAdded INTEGER, lastModified INTEGER, guid TEXT, syncStatus INTEGER NOT NULL DEFAULT 0, syncChangeCounter INTEGER NOT NULL DEFAULT 1)",
  );
  const placeRow = db.prepare(
    "INSERT INTO moz_places (id, url, title, visit_count, hidden, last_visit_date) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const places: [number, string, string | null, number, number, number | null][] = [
    [1, "https://kamapathy.app/", "Kamapathy", 4, 0, 1750000000000000],
    [2, "https://example.com/docs", "Docs", 2, 0, 1740000000000000],
    [3, "https://example.com/hidden", "Hidden", 1, 1, 1760000000000000],
    [4, "place:sort=8&maxResults=10", "Recent", 0, 0, null],
    [5, "https://example.com/never", "Never visited", 0, 0, null],
    [6, "https://example.com/menu", "Menu", 1, 0, 1730000000000000],
    [7, "https://example.com/unfiled", "Unfiled", 1, 0, 1720000000000000],
    [8, "https://example.com/mobile", "Mobile", 1, 0, 1710000000000000],
  ];
  for (const row of places) placeRow.run(...row);
  const bookmarkRow = db.prepare(
    "INSERT INTO moz_bookmarks (id, type, fk, parent, position, title, guid) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const bookmarks: [number, number, number | null, number, number, string | null, string][] = [
    [1, 2, null, 0, 0, "", "root________"],
    [2, 2, null, 1, 0, "menu", "menu________"],
    [3, 2, null, 1, 1, "toolbar", "toolbar_____"],
    [4, 2, null, 1, 2, "tags", "tags________"],
    [5, 2, null, 1, 3, "unfiled", "unfiled_____"],
    [6, 2, null, 1, 4, "mobile", "mobile______"],
    [7, 1, 1, 3, 1, "Kamapathy", "b0000000007_"],
    [8, 2, null, 3, 0, "Folder", "b0000000008_"],
    [9, 1, 2, 8, 0, "Docs", "b0000000009_"],
    [10, 1, 4, 3, 2, "Recent tags", "b0000000010_"],
    [11, 1, 5, 3, 3, "Never visited", "b0000000011_"],
    [12, 1, 6, 2, 0, "Menu", "b0000000012_"],
    [13, 2, null, 4, 0, "tagname", "b0000000013_"],
    [14, 1, 1, 13, 0, null, "b0000000014_"],
    [15, 1, 7, 5, 0, "Unfiled", "b0000000015_"],
    [16, 1, 8, 6, 0, "Mobile", "b0000000016_"],
    [17, 3, null, 3, 4, null, "b0000000017_"],
  ];
  for (const row of bookmarks) bookmarkRow.run(...row);
  db.close();
}

function safariHistory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE history_items (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, domain_expansion TEXT NULL, visit_count INTEGER NOT NULL, daily_visit_counts BLOB NOT NULL, weekly_visit_counts BLOB NULL, autocomplete_triggers BLOB NULL, should_recompute_derived_visit_counts INTEGER NOT NULL, visit_count_score INTEGER NOT NULL, status_code INTEGER NOT NULL DEFAULT 0)",
  );
  db.exec(
    "CREATE TABLE history_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, history_item INTEGER NOT NULL REFERENCES history_items(id) ON DELETE CASCADE, visit_time REAL NOT NULL, title TEXT NULL, load_successful BOOLEAN NOT NULL DEFAULT 1, http_non_get BOOLEAN NOT NULL DEFAULT 0, synthesized BOOLEAN NOT NULL DEFAULT 0, redirect_source INTEGER NULL UNIQUE REFERENCES history_visits(id) ON DELETE CASCADE, redirect_destination INTEGER NULL UNIQUE REFERENCES history_visits(id) ON DELETE CASCADE, origin INTEGER NOT NULL DEFAULT 0, generation INTEGER NOT NULL DEFAULT 0, attributes INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0)",
  );
  const item = db.prepare(
    "INSERT INTO history_items (id, url, visit_count, daily_visit_counts, should_recompute_derived_visit_counts, visit_count_score) VALUES (?, ?, ?, X'', 0, 0)",
  );
  item.run(1, "https://kamapathy.app/", 3);
  item.run(2, "https://example.com/redirect", 1);
  item.run(3, "https://example.com/lonely", 0);
  item.run(4, "http://localhost:3000/", 2);
  item.run(5, "file:///Users/me/a.html", 1);
  const visit = db.prepare(
    "INSERT INTO history_visits (history_item, visit_time, title) VALUES (?, ?, ?)",
  );
  visit.run(1, 760000000.5, "Kamapathy");
  visit.run(1, 770000000.25, null);
  visit.run(2, 750000000, "Redirect");
  visit.run(4, 740000000, null);
  visit.run(5, 745000000, "File");
  db.close();
}

describe("timestamps", () => {
  it("converts each browser's clock to milliseconds since the epoch", () => {
    expect(chromiumTime(13400000000000000)).toBe(1755526400000);
    expect(firefoxTime(1750000000000000)).toBe(1750000000000);
    expect(safariTime(770000000.25)).toBe(1748307200250);
    expect(chromiumTime(NaN)).toBeNaN();
  });
});

describe("bookmark parsers", () => {
  it("flattens Chromium roots in order and keeps web URLs only", () => {
    expect(parseChromiumBookmarks(fixtureJson("chromium/Bookmarks"))).toEqual([
      { title: "Kamapathy", url: "https://kamapathy.app/" },
      { title: "Docs", url: "https://kamapathy.app/docs/" },
      { title: "Nested", url: "https://example.com/nested" },
      { title: "https://example.com/untitled", url: "https://example.com/untitled" },
      { title: "Padded", url: "https://example.com/padded" },
      { title: "Other page", url: "https://example.com/other" },
      { title: "Phone", url: "https://example.com/phone" },
    ]);
  });
  it("trims titles, drops duplicates and stops at 1000 Chromium bookmarks", () => {
    const children = Array.from({ length: 1200 }, (_, index) => ({
      type: "url",
      name: index === 0 ? "x".repeat(400) : `Page ${index}`,
      url: `https://example.com/${index % 1100}`,
    }));
    const parsed = parseChromiumBookmarks({ roots: { bookmark_bar: { children } } });
    expect(parsed).toHaveLength(1000);
    expect(parsed[0].title).toHaveLength(300);
    expect(new Set(parsed.map((item) => item.url)).size).toBe(1000);
    expect(parseChromiumBookmarks(null)).toEqual([]);
    expect(parseChromiumBookmarks("text")).toEqual([]);
  });
  it("reads Safari's bookmark bar first, then the other lists", () => {
    expect(parseSafariBookmarks(fixtureJson("safari/Bookmarks.json"))).toEqual([
      { title: "Kamapathy", url: "https://kamapathy.app/" },
      { title: "Nested", url: "https://example.com/nested" },
      { title: "https://example.com/untitled", url: "https://example.com/untitled" },
      { title: "Menu page", url: "https://example.com/menu" },
      { title: "Saved article", url: "https://example.com/article" },
    ]);
    expect(parseSafariBookmarks({})).toEqual([]);
  });
});

describe("browser detection", () => {
  it("lists installed browsers and their profiles on macOS", () => {
    const home = folder();
    const chrome = join(support(home), "Google", "Chrome");
    place("chromium/Local State", join(chrome, "Local State"));
    mkdirSync(join(chrome, "Default"));
    mkdirSync(join(chrome, "Profile 1"));
    mkdirSync(join(support(home), "Microsoft Edge", "Default"), { recursive: true });
    write(join(support(home), "com.operasoftware.Opera", "Bookmarks"), "{}");
    mkdirSync(join(support(home), "BraveSoftware", "Brave-Browser"), { recursive: true });
    const firefox = join(support(home), "Firefox");
    place("firefox/profiles.ini", join(firefox, "profiles.ini"));
    mkdirSync(join(firefox, "Profiles", "a1b2c3d4.default"), { recursive: true });
    mkdirSync(join(firefox, "Profiles", "k3p9x1zq.default-release"), { recursive: true });
    mkdirSync(join(home, "Library", "Safari"), { recursive: true });
    const exec: ImportEnv["exec"] = (command) =>
      command === "plutil"
        ? launchServices({ LSHandlerURLScheme: "https", LSHandlerRoleAll: "com.google.Chrome" })
        : "";

    expect(availableBrowsers(mac(home, exec))).toEqual([
      {
        id: "chrome",
        name: "Google Chrome",
        default: true,
        profiles: [
          { id: "Profile 1", name: "Work" },
          { id: "Default", name: "Person 1" },
        ],
      },
      {
        id: "edge",
        name: "Microsoft Edge",
        default: false,
        profiles: [{ id: "Default", name: "Default" }],
      },
      { id: "brave", name: "Brave", default: false, profiles: [] },
      {
        id: "opera",
        name: "Opera",
        default: false,
        profiles: [{ id: ".", name: "Default" }],
      },
      {
        id: "firefox",
        name: "Firefox",
        default: false,
        profiles: [
          { id: "Profiles/k3p9x1zq.default-release", name: "default-release" },
          { id: "Profiles/a1b2c3d4.default", name: "default" },
        ],
      },
      {
        id: "safari",
        name: "Safari",
        default: false,
        profiles: [{ id: "default", name: "Default" }],
      },
    ]);
  });
  it("uses the local and roaming application data folders on Windows", () => {
    const home = folder();
    const local = join(home, "AppData", "Local");
    const roaming = join(home, "AppData", "Roaming");
    mkdirSync(join(local, "Google", "Chrome", "User Data", "Default"), { recursive: true });
    mkdirSync(join(local, "Microsoft", "Edge", "User Data", "Default"), { recursive: true });
    write(join(roaming, "Opera Software", "Opera Stable", "History"));
    write(join(roaming, "Mozilla", "Firefox", "profiles.ini"), "[Profile0]\nName=default\nIsRelative=1\nPath=Profiles/abc.default\n");
    mkdirSync(join(roaming, "Mozilla", "Firefox", "Profiles", "abc.default"), { recursive: true });
    mkdirSync(join(home, "Library", "Safari"), { recursive: true });
    const env: ImportEnv = {
      platform: "win32",
      home,
      appData: roaming,
      localAppData: local,
      exec: (command) => (command === "reg" ? registry("FirefoxURL-308046B0AF4A39CB") : ""),
    };
    expect(availableBrowsers(env).map((source) => [source.id, source.default])).toEqual([
      ["chrome", false],
      ["edge", false],
      ["opera", false],
      ["firefox", true],
    ]);
    expect(availableBrowsers({ ...env, localAppData: undefined }).map((source) => source.id)).toEqual([
      "opera",
      "firefox",
    ]);
  });
  it("looks under the home folder on Linux", () => {
    const home = folder();
    mkdirSync(join(home, ".config", "google-chrome", "Default"), { recursive: true });
    mkdirSync(join(home, ".config", "BraveSoftware", "Brave-Browser", "Default"), { recursive: true });
    write(join(home, ".mozilla", "firefox", "profiles.ini"), "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\n");
    mkdirSync(join(home, ".mozilla", "firefox", "abc.default"), { recursive: true });
    mkdirSync(join(home, "Library", "Safari"), { recursive: true });
    const env: ImportEnv = {
      platform: "linux",
      home,
      exec: (command) => (command === "xdg-settings" ? "brave-browser.desktop\n" : ""),
    };
    expect(availableBrowsers(env)).toEqual([
      { id: "chrome", name: "Google Chrome", default: false, profiles: [{ id: "Default", name: "Default" }] },
      { id: "brave", name: "Brave", default: true, profiles: [{ id: "Default", name: "Default" }] },
      { id: "firefox", name: "Firefox", default: false, profiles: [{ id: "abc.default", name: "default" }] },
    ]);
  });
  it("finds nothing in an empty home", () => {
    expect(availableBrowsers(mac(folder()))).toEqual([]);
  });
});

describe("default browser", () => {
  it("reads the LaunchServices handler on macOS", () => {
    const home = folder();
    const calls: [string, string[]][] = [];
    const lookup = (json: string) =>
      defaultBrowser(
        mac(home, (command, args) => {
          calls.push([command, args]);
          return json;
        }),
      );
    expect(lookup(launchServices({ LSHandlerURLScheme: "https", LSHandlerRoleAll: "com.google.chrome" }))).toBe("chrome");
    expect(calls[0]).toEqual([
      "plutil",
      [
        "-convert",
        "json",
        "-o",
        "-",
        join(home, "Library", "Preferences", "com.apple.LaunchServices", "com.apple.launchservices.secure.plist"),
      ],
    ]);
    expect(lookup(launchServices({ LSHandlerURLScheme: "http", LSHandlerRoleViewer: "org.mozilla.firefox" }))).toBe("firefox");
    expect(lookup(launchServices({ LSHandlerURLScheme: "https", LSHandlerRoleAll: "com.microsoft.edgemac" }))).toBe("edge");
    expect(lookup(launchServices({ LSHandlerURLScheme: "https", LSHandlerRoleAll: "company.thebrowser.Browser" }))).toBe("arc");
    expect(lookup(launchServices({ LSHandlerURLScheme: "https", LSHandlerRoleAll: "com.kagi.kagimacos" }))).toBeUndefined();
    expect(lookup(launchServices())).toBe("safari");
    expect(lookup("not json")).toBeUndefined();
    expect(defaultBrowser(mac(home, failing))).toBeUndefined();
  });
  it("reads the UserChoice ProgId on Windows", () => {
    const lookup = (output: string, exec?: ImportEnv["exec"]) =>
      defaultBrowser({
        platform: "win32",
        home: "C:\\Users\\me",
        exec:
          exec ??
          ((command, args) => {
            expect(command).toBe("reg");
            expect(args).toEqual([
              "query",
              "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
              "/v",
              "ProgId",
            ]);
            return output;
          }),
      });
    expect(lookup(registry("MSEdgeHTM"))).toBe("edge");
    expect(lookup(registry("ChromeHTML"))).toBe("chrome");
    expect(lookup(registry("BraveHTML"))).toBe("brave");
    expect(lookup(registry("OperaStable"))).toBe("opera");
    expect(lookup(registry("IE.HTTPS"))).toBeUndefined();
    expect(lookup("")).toBeUndefined();
    expect(lookup("", failing)).toBeUndefined();
  });
  it("asks xdg-settings on Linux", () => {
    const lookup = (output: string) =>
      defaultBrowser({
        platform: "linux",
        home: "/home/me",
        exec: (command, args) => {
          expect([command, args]).toEqual(["xdg-settings", ["get", "default-web-browser"]]);
          return output;
        },
      });
    expect(lookup("firefox.desktop\n")).toBe("firefox");
    expect(lookup("google-chrome.desktop\n")).toBe("chrome");
    expect(lookup("chromium.desktop\n")).toBe("chromium");
    expect(lookup("vivaldi-stable.desktop\n")).toBe("vivaldi");
    expect(lookup("org.gnome.Epiphany.desktop\n")).toBeUndefined();
    expect(lookup("\n")).toBeUndefined();
    expect(defaultBrowser({ platform: "linux", home: "/home/me", exec: failing })).toBeUndefined();
  });
  it("knows nothing about other platforms", () => {
    expect(defaultBrowser({ platform: "freebsd", home: "/home/me", exec: failing })).toBeUndefined();
  });
});

describe("Chromium import", () => {
  const rows: [string, string | null, number, number, number][] = [
    ["https://kamapathy.app/", "Kamapathy", 5, 13400000000000000, 0],
    ["https://example.com/docs", null, 2, 13390000000000000, 0],
    ["https://example.com/hidden", "Hidden", 1, 13395000000000000, 1],
    ["chrome://newtab/", "New Tab", 9, 13399000000000000, 0],
    ["file:///Users/me/a.html", "File", 1, 13398000000000000, 0],
    ["https://example.com/future", "Future", 0, 20000000000000000, 0],
    ["https://example.com/never", "Never", 0, 0, 0],
  ];
  function chromeProfile(home: string): string {
    const chrome = join(support(home), "Google", "Chrome");
    place("chromium/Local State", join(chrome, "Local State"));
    mkdirSync(join(chrome, "Default"));
    mkdirSync(join(chrome, "Profile 1"));
    return join(chrome, "Profile 1");
  }
  it("reads a copy of the history while the browser holds the file locked", async () => {
    const home = folder();
    const profile = chromeProfile(home);
    place("chromium/Bookmarks", join(profile, "Bookmarks"));
    const source = chromiumHistory(join(profile, "History"), rows);
    source.exec("BEGIN EXCLUSIVE");
    const direct = new DatabaseSync(join(profile, "History"), { readOnly: true });
    expect(() => direct.prepare("SELECT url FROM urls").all()).toThrow(/locked/);
    direct.close();
    const temporary = () =>
      readdirSync(tmpdir()).filter((name) => name.startsWith("kamapathy-import-")).length;
    const before = temporary();
    const started = Date.now();

    const result = await importFrom("chrome", undefined, both, mac(home));

    source.exec("COMMIT");
    source.close();
    expect(result.warnings).toEqual([]);
    expect(result.bookmarks).toHaveLength(7);
    expect(result.bookmarks[0]).toEqual({ title: "Kamapathy", url: "https://kamapathy.app/" });
    expect(result.history.map((visit) => visit.url)).toEqual([
      "https://example.com/future",
      "https://kamapathy.app/",
      "https://example.com/docs",
    ]);
    expect(result.history[0].visits).toBe(1);
    expect(result.history[0].visitedAt).toBeGreaterThanOrEqual(started);
    expect(result.history[0].visitedAt).toBeLessThanOrEqual(Date.now());
    expect(result.history[1]).toEqual({
      title: "Kamapathy",
      url: "https://kamapathy.app/",
      visitedAt: 1755526400000,
      visits: 5,
    });
    expect(result.history[2].title).toBe("https://example.com/docs");
    expect(temporary()).toBe(before);
  });
  it("keeps the 1000 most recent visits", async () => {
    const home = folder();
    const profile = chromeProfile(home);
    const many: [string, string | null, number, number, number][] = Array.from(
      { length: 1200 },
      (_, index) => [`https://example.com/${index}`, `Page ${index}`, 1, 13300000000000000 + index * 1000000, 0],
    );
    chromiumHistory(join(profile, "History"), many).close();
    const result = await importFrom("chrome", "Profile 1", { bookmarks: true, history: true }, mac(home));
    expect(result.history).toHaveLength(1000);
    expect(result.history[0].url).toBe("https://example.com/1199");
    expect(result.history[999].url).toBe("https://example.com/200");
    expect(result.bookmarks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
  it("honours the requested profile and the option switches", async () => {
    const home = folder();
    const chrome = join(support(home), "Google", "Chrome");
    chromeProfile(home);
    place("chromium/Bookmarks", join(chrome, "Default", "Bookmarks"));
    chromiumHistory(join(chrome, "Default", "History"), rows).close();
    const onlyBookmarks = await importFrom("chrome", "Default", { bookmarks: true, history: false }, mac(home));
    expect(onlyBookmarks.bookmarks).toHaveLength(7);
    expect(onlyBookmarks.history).toEqual([]);
    const onlyHistory = await importFrom("chrome", "Default", { bookmarks: false, history: true }, mac(home));
    expect(onlyHistory.bookmarks).toEqual([]);
    expect(onlyHistory.history).toHaveLength(3);
  });
  it("reads a single profile kept in the data folder itself", async () => {
    const home = folder();
    const opera = join(support(home), "com.operasoftware.Opera");
    place("chromium/Bookmarks", join(opera, "Bookmarks"));
    chromiumHistory(join(opera, "History"), rows).close();
    const result = await importFrom("opera", undefined, both, mac(home));
    expect(result.bookmarks).toHaveLength(7);
    expect(result.history).toHaveLength(3);
  });
  it("turns unreadable files into warnings and carries on", async () => {
    const home = folder();
    const profile = chromeProfile(home);
    write(join(profile, "Bookmarks"), "{ not json");
    write(join(profile, "History"), "not a database");
    const result = await importFrom("chrome", undefined, both, mac(home));
    expect(result).toEqual({
      bookmarks: [],
      history: [],
      warnings: ["Could not read Google Chrome bookmarks.", "Could not read Google Chrome history."],
    });
    rmSync(join(profile, "Bookmarks"));
    rmSync(join(profile, "History"));
    expect(await importFrom("chrome", undefined, both, mac(home))).toEqual({
      bookmarks: [],
      history: [],
      warnings: [],
    });
  });
  it("rejects unknown browsers and profiles", async () => {
    const home = folder();
    await expect(importFrom("nope" as BrowserId, undefined, both, mac(home))).rejects.toThrow("Unknown browser.");
    await expect(importFrom("chrome", undefined, both, mac(home))).rejects.toThrow(
      "Google Chrome was not found on this computer.",
    );
    chromeProfile(home);
    await expect(importFrom("chrome", "Profile 9", both, mac(home))).rejects.toThrow(
      "Google Chrome profile was not found.",
    );
    await expect(importFrom("safari", undefined, both, { platform: "linux", home, exec: silent })).rejects.toThrow(
      "Safari was not found on this computer.",
    );
  });
});

describe("Firefox import", () => {
  it("walks the bookmark roots in order and lists visited places", async () => {
    const home = folder();
    const firefox = join(support(home), "Firefox");
    place("firefox/profiles.ini", join(firefox, "profiles.ini"));
    const release = join(firefox, "Profiles", "k3p9x1zq.default-release");
    firefoxPlaces(join(release, "places.sqlite"));
    const other = join(firefox, "Profiles", "a1b2c3d4.default");
    mkdirSync(other, { recursive: true });

    const result = await importFrom("firefox", undefined, both, mac(home));

    expect(result.warnings).toEqual([]);
    expect(result.bookmarks).toEqual([
      { title: "Docs", url: "https://example.com/docs" },
      { title: "Kamapathy", url: "https://kamapathy.app/" },
      { title: "Never visited", url: "https://example.com/never" },
      { title: "Menu", url: "https://example.com/menu" },
      { title: "Unfiled", url: "https://example.com/unfiled" },
      { title: "Mobile", url: "https://example.com/mobile" },
    ]);
    expect(result.history).toEqual([
      { title: "Kamapathy", url: "https://kamapathy.app/", visitedAt: 1750000000000, visits: 4 },
      { title: "Docs", url: "https://example.com/docs", visitedAt: 1740000000000, visits: 2 },
      { title: "Menu", url: "https://example.com/menu", visitedAt: 1730000000000, visits: 1 },
      { title: "Unfiled", url: "https://example.com/unfiled", visitedAt: 1720000000000, visits: 1 },
      { title: "Mobile", url: "https://example.com/mobile", visitedAt: 1710000000000, visits: 1 },
    ]);
    const empty = await importFrom("firefox", "Profiles/a1b2c3d4.default", both, mac(home));
    expect(empty).toEqual({ bookmarks: [], history: [], warnings: [] });
    await expect(importFrom("firefox", "Profiles/none", both, mac(home))).rejects.toThrow(
      "Firefox profile was not found.",
    );
  });
  it("follows absolute profile paths", async () => {
    const home = folder();
    const elsewhere = folder();
    firefoxPlaces(join(elsewhere, "places.sqlite"));
    write(
      join(support(home), "Firefox", "profiles.ini"),
      `[Profile0]\nName=elsewhere\nIsRelative=0\nPath=${elsewhere}\n`,
    );
    expect(availableBrowsers(mac(home))).toEqual([
      { id: "firefox", name: "Firefox", default: false, profiles: [{ id: elsewhere, name: "elsewhere" }] },
    ]);
    const result = await importFrom("firefox", elsewhere, { bookmarks: false, history: true }, mac(home));
    expect(result.history).toHaveLength(5);
    expect(result.bookmarks).toEqual([]);
  });
  it("warns once when places.sqlite cannot be read", async () => {
    const home = folder();
    write(join(support(home), "Firefox", "profiles.ini"), "[Profile0]\nName=default\nIsRelative=1\nPath=abc\n");
    write(join(support(home), "Firefox", "abc", "places.sqlite"), "broken");
    const result = await importFrom("firefox", undefined, both, mac(home));
    expect(result.warnings).toEqual(["Could not read Firefox bookmarks and history."]);
    const historyOnly = await importFrom("firefox", undefined, { bookmarks: false, history: true }, mac(home));
    expect(historyOnly.warnings).toEqual(["Could not read Firefox history."]);
  });
});

describe("Safari import", () => {
  const blocked =
    "macOS blocked access to Safari's history. Give Kamapathy Full Disk Access in System Settings > Privacy & Security, then try again.";
  function safariHome(): string {
    const home = folder();
    write(join(home, "Library", "Safari", "Bookmarks.plist"), "bplist00");
    safariHistory(join(home, "Library", "Safari", "History.db"));
    return home;
  }
  it("converts the bookmark plist through plutil and reads the latest visits", async () => {
    const home = safariHome();
    const calls: [string, string[]][] = [];
    const env = mac(home, (command, args) => {
      calls.push([command, args]);
      return readFileSync(join(fixtures, "safari/Bookmarks.json"), "utf8");
    });

    const result = await importFrom("safari", undefined, both, env);

    expect(result.warnings).toEqual([]);
    expect(result.bookmarks).toHaveLength(5);
    expect(result.bookmarks[0]).toEqual({ title: "Kamapathy", url: "https://kamapathy.app/" });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("plutil");
    expect(calls[0][1].slice(0, 4)).toEqual(["-convert", "json", "-o", "-"]);
    expect(calls[0][1][4]).toMatch(/Bookmarks\.plist$/);
    expect(calls[0][1][4]).not.toBe(join(home, "Library", "Safari", "Bookmarks.plist"));
    expect(result.history).toEqual([
      { title: "Kamapathy", url: "https://kamapathy.app/", visitedAt: 1748307200250, visits: 3 },
      { title: "Redirect", url: "https://example.com/redirect", visitedAt: 1728307200000, visits: 1 },
      { title: "http://localhost:3000/", url: "http://localhost:3000/", visitedAt: 1718307200000, visits: 2 },
    ]);
  });
  it("is not offered away from macOS", () => {
    const home = safariHome();
    expect(availableBrowsers({ platform: "linux", home, exec: silent })).toEqual([]);
  });
  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "explains the Full Disk Access requirement instead of failing",
    async () => {
      const home = safariHome();
      const env = mac(home, () => readFileSync(join(fixtures, "safari/Bookmarks.json"), "utf8"));
      chmodSync(join(home, "Library", "Safari", "History.db"), 0o000);
      const partial = await importFrom("safari", undefined, both, env);
      expect(partial.warnings).toEqual([blocked]);
      expect(partial.bookmarks).toHaveLength(5);
      expect(partial.history).toEqual([]);

      chmodSync(join(home, "Library", "Safari", "Bookmarks.plist"), 0o000);
      const nothing = await importFrom("safari", undefined, both, env);
      expect(nothing).toEqual({ bookmarks: [], history: [], warnings: [blocked] });
      chmodSync(join(home, "Library", "Safari", "History.db"), 0o600);
      chmodSync(join(home, "Library", "Safari", "Bookmarks.plist"), 0o600);
    },
  );
  it("reports a plist that plutil cannot convert", async () => {
    const home = safariHome();
    const result = await importFrom("safari", undefined, { bookmarks: true, history: false }, mac(home, failing));
    expect(result).toEqual({ bookmarks: [], history: [], warnings: ["Could not read Safari bookmarks."] });
  });
});
