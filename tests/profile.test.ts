import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateProfile } from "../electron/profile";

const directories: string[] = [];
function folder(): string {
  const directory = mkdtempSync(join(tmpdir(), "kamapathy-profile-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function write(path: string, text = "data") {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

describe("profile migration", () => {
  it("copies the old profile without locks, the agent channel or caches", () => {
    const root = folder();
    const from = join(root, "Grove");
    const to = join(root, "Kamapathy");
    write(join(from, "browser-state.json"), "{}");
    write(join(from, "Partitions", "space", "Cookies"), "cookies");
    write(join(from, "Local Storage", "leveldb", "000003.log"));
    write(join(from, "agent", "connection.json"));
    write(join(from, "Cache", "Cache_Data", "index"));
    write(join(from, "Partitions", "space", "Code Cache", "js", "index"));
    write(join(from, "Partitions", "space", "GPUCache", "data_0"));
    symlinkSync("host-1234", join(from, "SingletonLock"));

    expect(migrateProfile(from, to)).toBe(true);

    expect(readFileSync(join(to, "browser-state.json"), "utf8")).toBe("{}");
    expect(readFileSync(join(to, "Partitions", "space", "Cookies"), "utf8")).toBe(
      "cookies",
    );
    expect(existsSync(join(to, "Local Storage", "leveldb", "000003.log"))).toBe(true);
    for (const left of [
      "agent",
      "Cache",
      "SingletonLock",
      join("Partitions", "space", "Code Cache"),
      join("Partitions", "space", "GPUCache"),
    ])
      expect(existsSync(join(to, left)), left).toBe(false);
    expect(existsSync(join(from, "browser-state.json"))).toBe(true);
    expect(existsSync(`${to}.migrating`)).toBe(false);
  });

  it("leaves an existing profile alone", () => {
    const root = folder();
    const from = join(root, "Grove");
    const to = join(root, "Kamapathy");
    write(join(from, "browser-state.json"), "old");
    write(join(to, "browser-state.json"), "new");
    expect(migrateProfile(from, to)).toBe(false);
    expect(readFileSync(join(to, "browser-state.json"), "utf8")).toBe("new");
  });

  it("does nothing when there is no old profile", () => {
    const root = folder();
    const to = join(root, "Kamapathy");
    expect(migrateProfile(join(root, "Grove"), to)).toBe(false);
    expect(existsSync(to)).toBe(false);
  });

  it("starts over from a copy that was cut short", () => {
    const root = folder();
    const from = join(root, "Grove");
    const to = join(root, "Kamapathy");
    write(join(from, "browser-state.json"), "{}");
    write(join(`${to}.migrating`, "partial"), "half");
    expect(migrateProfile(from, to)).toBe(true);
    expect(existsSync(join(to, "partial"))).toBe(false);
    expect(readFileSync(join(to, "browser-state.json"), "utf8")).toBe("{}");
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "starts a fresh profile when the old one cannot be read",
    () => {
      const root = folder();
      const from = join(root, "Grove");
      const to = join(root, "Kamapathy");
      write(join(from, "Cookies"), "cookies");
      chmodSync(join(from, "Cookies"), 0o000);
      expect(migrateProfile(from, to)).toBe(false);
      expect(existsSync(to)).toBe(false);
      expect(existsSync(`${to}.migrating`)).toBe(false);
      chmodSync(join(from, "Cookies"), 0o600);
    },
  );
});
