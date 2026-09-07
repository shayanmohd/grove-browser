#!/usr/bin/env node
import { cp, lstat, mkdir, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index++) {
  if (!["--destination", "--restore"].includes(args[index]) || !args[index + 1])
    throw new Error(
      "Usage: node scripts/install-skill.mjs [--destination <skill-directory>] [--restore <backup-directory>]",
    );
  options[args[index].slice(2)] = args[++index];
}
const target = resolve(
  options.destination ||
    join(
      process.env.CODEX_HOME || join(homedir(), ".codex"),
      "skills",
      "grove-browser",
    ),
);
const source = options.restore
  ? resolve(options.restore)
  : resolve(dirname(fileURLToPath(import.meta.url)), "../skills/grove-browser");
const sourceInfo = await lstat(source);
if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink())
  throw new Error("Skill source must be a regular directory.");
if (
  source === target ||
  target.startsWith(`${source}${sep}`) ||
  source.startsWith(`${target}${sep}`)
)
  throw new Error("Source and destination must be separate directories.");
if (
  options.restore &&
  (dirname(source) !== dirname(target) ||
    !basename(source).startsWith(".grove-browser-backup-"))
)
  throw new Error(
    "Restore accepts only a Grove backup beside the destination.",
  );
await lstat(join(source, "SKILL.md"));
await lstat(join(source, "scripts/grove.mjs"));
await mkdir(dirname(target), { recursive: true });
const staging = join(dirname(target), `.grove-browser-install-${randomUUID()}`);
const backup = join(
  dirname(target),
  `.grove-browser-backup-${Date.now()}-${randomUUID().slice(0, 8)}`,
);
let backedUp = false;
try {
  await cp(source, staging, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  const current = await lstat(target).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (current) {
    if (!current.isDirectory() || current.isSymbolicLink())
      throw new Error(
        "Destination exists and is not a regular directory. It was left unchanged.",
      );
    await rename(target, backup);
    backedUp = true;
  }
  try {
    await rename(staging, target);
  } catch (error) {
    if (backedUp) await rename(backup, target);
    throw error;
  }
  process.stdout.write(
    `${options.restore ? "Restored" : "Installed"} Grove skill: ${target}\n`,
  );
  if (backedUp)
    process.stdout.write(
      `Previous version preserved: ${backup}\nRestore it with this installer using --restore and that path.\n`,
    );
  process.stdout.write(
    "Start a new Codex session to discover the installed skill.\n",
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
