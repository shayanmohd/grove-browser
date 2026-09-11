import { waitForState } from "./wait.mjs";
import { _electron as electron } from "playwright";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const profile = await mkdtemp(join(tmpdir(), "grove-portfolio-"));
const environment = { ...process.env, GROVE_USER_DATA: profile };
delete environment.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({
    args: [resolve("out/main/index.js")],
    env: environment,
  });
  const page = await app.firstWindow();
  await page.waitForSelector(".home-intro");
  await page.evaluate(() =>
    window.grove.dispatch({
      type: "settings:update",
      settings: { theme: "light" },
    }),
  );
  for (const url of [
    "https://github.com",
    "https://developer.mozilla.org/en-US/",
  ]) {
    await page.evaluate(
      (url) =>
        window.grove.dispatch({ type: "tab:create", url, background: true }),
      url,
    );
  }
  await waitForState(
    page,
    (state) => state.tabs.every((tab) => !tab.loading),
    undefined,
    {
      timeoutMs: 20000,
    },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await mkdir("docs/images", { recursive: true });
  await page.screenshot({ path: "docs/images/grove-light.png", scale: "css" });
  console.log(
    await page.evaluate(() => ({
      screen: [innerWidth, innerHeight],
      content: {
        height: document.querySelector(".home-page").clientHeight,
        scrollHeight: document.querySelector(".home-page").scrollHeight,
      },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    })),
  );
  await page.evaluate(() =>
    window.grove.dispatch({
      type: "settings:update",
      settings: { theme: "dark" },
    }),
  );
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: "docs/images/grove-dark.png", scale: "css" });
  await page
    .getByRole("button", { name: "Open agent studio", exact: true })
    .click();
  await page.waitForSelector(".side-panel");
  await page.waitForTimeout(250);
  await page.screenshot({ path: "docs/images/grove-agents.png", scale: "css" });
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: /Search anything/ }).click();
  await page.waitForSelector('[role="combobox"]');
  await page.waitForTimeout(250);
  await page.screenshot({
    path: "docs/images/grove-command.png",
    scale: "css",
  });
  console.log(
    "Saved four screenshots of the real desktop interface in docs/images.",
  );
} finally {
  if (app) await app.close();
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 150,
  });
}
