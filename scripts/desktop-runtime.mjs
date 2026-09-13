import { createHash } from "node:crypto";
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const projectDirectory = fileURLToPath(new URL("../", import.meta.url));

export function runtimeExecutable(directory, platform = process.platform) {
  if (platform === "darwin") return join(directory, "Grove.app", "Contents", "MacOS", "Grove");
  return join(directory, platform === "win32" ? "Grove.exe" : "grove");
}

async function available(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Use the same native branding pipeline as releases, once per runtime and icon
// revision. The original Electron installation is never edited.
export async function prepareDesktopRuntime() {
  const metadata = JSON.parse(await readFile(join(projectDirectory, "package.json"), "utf8"));
  const electronDirectory = dirname(require.resolve("electron/package.json"));
  const electronVersion = JSON.parse(await readFile(join(electronDirectory, "package.json"), "utf8")).version;
  const builderVersion = require("electron-builder/package.json").version;
  const fingerprint = createHash("sha256")
    .update(await readFile(fileURLToPath(import.meta.url)))
    .update(JSON.stringify([process.platform, process.arch, metadata, electronVersion, builderVersion]));
  for (const icon of ["icon.icns", "icon.ico", "icon.png"])
    fingerprint.update(await readFile(join(projectDirectory, "build", icon)));
  const cacheDirectory = join(projectDirectory, "node_modules", ".cache", "grove-runtime");
  const destination = join(cacheDirectory, fingerprint.digest("hex").slice(0, 20));
  const executable = runtimeExecutable(destination);
  if (await available(join(destination, ".ready")) && await available(executable))
    return executable;

  await mkdir(cacheDirectory, { recursive: true });
  const staging = await mkdtemp(join(cacheDirectory, "preparing-"));
  try {
    console.log("Preparing the Grove desktop runtime. Future launches reuse this copy.");
    const { build, Platform } = await import("electron-builder");
    const source = join(staging, "source");
    await mkdir(source);
    await writeFile(join(source, "package.json"), JSON.stringify({
      name: "grove-browser",
      productName: "Grove",
      desktopName: "dev.grove.browser.desktop",
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      license: metadata.license,
      main: "index.cjs",
    }));
    await writeFile(join(source, "index.cjs"), 'require("electron").app.quit();\n');
    let outputDirectory;
    await build({
      projectDir: staging,
      targets: Platform.current().createTarget("dir"),
      publish: "never",
      config: {
        appId: "dev.grove.browser",
        productName: "Grove",
        directories: { app: source, output: join(staging, "output") },
        files: ["package.json", "index.cjs"],
        asar: false,
        npmRebuild: false,
        electronVersion,
        electronDist: join(electronDirectory, "dist"),
        mac: { icon: join(projectDirectory, "build/icon.icns"), identity: null, hardenedRuntime: false, notarize: false },
        win: { icon: join(projectDirectory, "build/icon.ico") },
        linux: { icon: join(projectDirectory, "build/icon.png"), executableName: "grove", syncDesktopName: true },
        afterPack(context) { outputDirectory = context.appOutDir; },
      },
    });
    if (!outputDirectory) throw new Error("The Grove desktop runtime was not created.");
    const resources = process.platform === "darwin"
      ? join(outputDirectory, "Grove.app", "Contents", "Resources")
      : join(outputDirectory, "resources");
    const originalResources = process.platform === "darwin"
      ? join(electronDirectory, "dist", "Electron.app", "Contents", "Resources")
      : join(electronDirectory, "dist", "resources");
    // Keep Electron's development entry loader so CLI arguments, Playwright,
    // process.defaultApp, and the Vite development server behave as before.
    await rm(join(resources, "app"), { recursive: true, force: true });
    await copyFile(join(originalResources, "default_app.asar"), join(resources, "default_app.asar"));
    await writeFile(join(outputDirectory, ".ready"), "Grove desktop runtime\n");
    try {
      await rename(outputDirectory, destination);
    } catch (error) {
      // Another launch can finish the same immutable cache while we prepare it.
      if (!(await available(join(destination, ".ready"))) || !(await available(executable)))
        throw error;
    }
    return executable;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export function desktopLaunch(mode, executable, environment = process.env) {
  if (mode !== "dev" && mode !== "start")
    throw new Error(`Unknown desktop mode: ${mode}. Use dev or start.`);
  const env = { ...environment, ELECTRON_EXEC_PATH: executable };
  delete env.ELECTRON_RUN_AS_NODE;
  return {
    executable: mode === "dev" ? process.execPath : executable,
    args: mode === "dev"
      ? [join(projectDirectory, "node_modules/electron-vite/bin/electron-vite.js"), "dev"]
      : [resolve(projectDirectory)],
    options: { cwd: projectDirectory, stdio: "inherit", env },
  };
}
