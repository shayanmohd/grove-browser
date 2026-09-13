import { spawn } from "node:child_process";
import { desktopLaunch, prepareDesktopRuntime } from "./desktop-runtime.mjs";

const mode = process.argv[2] || "dev";
const runtime = await prepareDesktopRuntime();
const { executable, args, options } = desktopLaunch(mode, runtime);
const child = spawn(executable, args, options);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
