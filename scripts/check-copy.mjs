import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([
  ".git",
  ".cache",
  ".vite",
  "node_modules",
  "out",
  "dist",
  "release",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
  "generated",
  "artifacts",
]);
const excludedFiles = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const checkedExtensions = new Set([
  ".ts",
  ".tsx",
  ".css",
  ".md",
  ".mjs",
  ".html",
  ".yml",
  ".yaml",
  ".json",
  ".svg",
  ".txt",
]);
const prohibitedCharacters = /[\u2013\u2014]/gu;
const violations = [];
let checkedFiles = 0;

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) await checkDirectory(path);
      continue;
    }
    if (
      !entry.isFile() ||
      excludedFiles.has(entry.name) ||
      !checkedExtensions.has(extname(entry.name))
    )
      continue;
    checkedFiles += 1;
    const lines = (await readFile(path, "utf8")).split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(prohibitedCharacters)) {
        const codePoint = match[0].codePointAt(0).toString(16).toUpperCase();
        violations.push(
          `${relative(projectRoot, path)}:${index + 1}:${match.index + 1}: replace U+${codePoint} with plain punctuation`,
        );
      }
    }
  }
}

await checkDirectory(projectRoot);
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Copy check passed for ${checkedFiles} source and documentation files.`,
  );
}
