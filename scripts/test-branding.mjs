import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { _electron as electron } from "playwright";
import { desktopLaunch, prepareDesktopRuntime, projectDirectory } from "./desktop-runtime.mjs";

const run = promisify(execFile);
const executable = await prepareDesktopRuntime();
assert.equal(await prepareDesktopRuntime(), executable);
assert.equal(basename(executable), process.platform === "win32" ? "Grove.exe" : process.platform === "darwin" ? "Grove" : "grove");
console.log("PASS branded runtime is reusable and has a native Grove executable");

if (process.platform === "darwin") {
  const contents = dirname(dirname(executable));
  const { stdout } = await run("/usr/bin/plutil", ["-convert", "json", "-o", "-", join(contents, "Info.plist")]);
  const info = JSON.parse(stdout);
  assert.equal(info.CFBundleName, "Grove");
  assert.equal(info.CFBundleDisplayName, "Grove");
  assert.equal(info.CFBundleExecutable, "Grove");
  assert.equal(info.CFBundleIdentifier, "dev.grove.browser");
  const expectedIcon = await readFile(join(projectDirectory, "build", "icon.icns"));
  const actualIcon = await readFile(join(contents, "Resources", info.CFBundleIconFile));
  assert.deepEqual(actualIcon, expectedIcon);
  console.log("PASS macOS bundle name, identifier, executable and app icon");
} else if (process.platform === "win32") {
  const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "(Get-Item -LiteralPath $env:GROVE_BRANDING_EXECUTABLE).VersionInfo | Select-Object ProductName,FileDescription | ConvertTo-Json -Compress"], {
    env: { ...process.env, GROVE_BRANDING_EXECUTABLE: executable },
  });
  const info = JSON.parse(stdout.trim());
  assert.equal(info.ProductName, "Grove");
  assert.equal(info.FileDescription, "Grove");
  console.log("PASS Windows executable product name and description");
}

const profile = await mkdtemp(join(tmpdir(), "grove-branding-"));
let app;
try {
  const launch = desktopLaunch("start", executable, { ...process.env, GROVE_USER_DATA: profile, ELECTRON_RUN_AS_NODE: "1" });
  app = await electron.launch({ executablePath: launch.executable, args: launch.args, cwd: profile, env: launch.options.env, timeout: 30000 });
  const page = await app.firstWindow();
  await page.waitForSelector(".home-page, .web-page");
  const identity = await app.evaluate(({ app, Menu }) => ({
    name: app.getName(),
    externalApplication: process.defaultApp,
    executable: process.execPath,
    profile: app.getPath("userData"),
    menu: Menu.getApplicationMenu()?.items.map((item) => item.label),
  }));
  assert.equal(identity.name, "Grove");
  assert.equal(identity.externalApplication, true);
  assert.equal(resolve(identity.executable), resolve(executable));
  assert.equal(resolve(identity.profile), resolve(profile));
  if (process.platform === "darwin") assert.equal(identity.menu?.[0], "Grove");
  console.log("PASS Grove starts from another working directory with its own identity and isolated profile");
  const development = desktopLaunch("dev", executable, { ELECTRON_RUN_AS_NODE: "1" });
  assert.equal(development.options.env.ELECTRON_EXEC_PATH, executable);
  assert.equal(development.options.env.ELECTRON_RUN_AS_NODE, undefined);
  console.log("PASS development launches use the same Grove runtime");
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
