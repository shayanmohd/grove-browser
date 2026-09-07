import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const mode = process.argv[2] || "dev";
const args =
  mode === "dev"
    ? [
        fileURLToPath(
          new URL(
            "../node_modules/electron-vite/bin/electron-vite.js",
            import.meta.url,
          ),
        ),
        "dev",
      ]
    : [fileURLToPath(new URL("../out/main/index.js", import.meta.url))];
const executable =
  mode === "dev" ? process.execPath : (await import("electron")).default;
const child = spawn(executable, args, { stdio: "inherit", env: environment });
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
