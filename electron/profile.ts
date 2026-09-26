import { cpSync, existsSync, renameSync, rmSync } from "node:fs";
import { basename } from "node:path";

// Locks, the agent channel and caches belong to the running copy of the old
// app, and Chromium rebuilds caches on its own.
const skipped = new Set(["agent", "Cache", "Code Cache", "GPUCache"]);

// Copies the profile from before the rename, once. The old folder stays, so
// the old app keeps working until the person removes it. A copy that fails
// leaves nothing behind, and the app starts with a fresh profile.
export function migrateProfile(from: string, to: string): boolean {
  if (existsSync(to) || !existsSync(from)) return false;
  const staging = `${to}.migrating`;
  try {
    rmSync(staging, { recursive: true, force: true });
    cpSync(from, staging, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (source) => {
        const name = basename(source);
        return !name.startsWith("Singleton") && !skipped.has(name);
      },
    });
    renameSync(staging, to);
    return true;
  } catch {
    rmSync(staging, { recursive: true, force: true });
    return false;
  }
}
