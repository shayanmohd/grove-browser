import { waitForState } from "./wait.mjs";
import { _electron as electron } from "playwright";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { startFormSite } from "../tests/fixtures/form-site.mjs";

const temporary = await mkdtemp(join(tmpdir(), "grove-review-"));
const fixture = await startFormSite();
const environment = {
  ...process.env,
  GROVE_USER_DATA: join(temporary, "profile"),
};
delete environment.ELECTRON_RUN_AS_NODE;
let browser;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (browser) await browser.close().catch(() => {});
  await fixture.close();
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 150,
  });
  process.exit(0);
}
try {
  browser = await electron.launch({
    args: [resolve("out/main/index.js")],
    env: environment,
  });
  const chrome = await browser.firstWindow();
  await chrome.waitForSelector(".home-intro");
  await chrome.evaluate(() =>
    window.grove.dispatch({
      type: "settings:update",
      settings: { automationEnabled: true },
    }),
  );
  await waitForState(chrome, (state) => state.automation.running);
  const connection = await chrome.evaluate(() =>
    window.grove.getAgentConnection(),
  );
  const connectionFile = join(temporary, "connection.json");
  await writeFile(connectionFile, JSON.stringify(connection), { mode: 0o600 });
  await mkdir("artifacts/review", { recursive: true });
  await writeFile(
    "artifacts/review/session.json",
    JSON.stringify(
      { fixtureOrigin: fixture.origin, connectionFile, pid: process.pid },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      ready: true,
      fixtureOrigin: fixture.origin,
      connectionFile,
    }),
  );
  process.stdin.resume();
  process.stdin.on("data", () => {
    void close();
  });
  process.on("SIGINT", () => {
    void close();
  });
  process.on("SIGTERM", () => {
    void close();
  });
} catch (error) {
  console.error(error.message);
  await close();
}
