import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "playwright";

const profile = await mkdtemp(join(tmpdir(), "grove-smoke-"));
let failRecoverablePage = true;
const fixture = createServer((request, response) => {
  if (request.url === "/recoverable" && failRecoverablePage) {
    request.socket.destroy();
    return;
  }
  response.writeHead(200, {
    "Content-Type": "text/html",
    "Cache-Control": "no-store",
  });
  const second = request.url === "/second";
  response.end(
    `<!doctype html><html lang="en"><head><title>${second ? "Second page" : "Grove test garden"}</title></head><body><h1>${second ? "Second page" : "Grove test garden"}</h1><a id="next" href="/second">Next page</a><label for="query">Research topic</label><input id="query"><button id="save">Save topic</button><p id="result">No topic saved</p><script>document.getElementById('save').onclick=()=>{document.getElementById('result').textContent=document.getElementById('query').value;};</script></body></html>`,
  );
});
await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${fixture.address().port}`;
let app;
let checks = 0;
const checked = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};
const env = { ...process.env, GROVE_USER_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
async function launch() {
  app = await electron.launch({
    args: [resolve("out/main/index.js")],
    env,
    timeout: 30000,
  });
  const page = await app.firstWindow();
  await page.waitForSelector(".home-page, .web-page");
  await page.waitForFunction(() => !!window.grove);
  return page;
}
try {
  let page = await launch();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let state = await page.evaluate(() => window.grove.getState());
  assert.equal(state.platform, process.platform);
  checked("desktop bridge and platform detection");
  await page
    .getByRole("button", { name: "Create a space", exact: true })
    .click();
  await page.getByLabel("Space name", { exact: true }).fill("Test project");
  await page.getByRole("button", { name: "Create space", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector(".space-button.active")
      ?.textContent?.includes("Test project"),
  );
  state = await page.evaluate(() => window.grove.getState());
  const project = state.activeSpaceId;
  checked("workspace creation through the interface");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  checked("light and dark theme controls");
  await page.getByRole("button", { name: /Search anything/ }).click();
  await page.getByRole("combobox").fill("settings");
  await page.getByRole("combobox").press("ArrowDown");
  await page.getByRole("combobox").press("Enter");
  await page.getByRole("heading", { name: "Make Grove yours" }).waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  checked("command palette keyboard navigation");
  const address = page.getByRole("textbox", {
    name: "Address bar",
    exact: true,
  });
  await address.fill(origin);
  await address.press("Enter");
  await page.waitForFunction(() =>
    document
      .querySelector(".tab-row.active .tab-select")
      ?.textContent?.includes("Grove test garden"),
  );
  state = await page.evaluate(() => window.grove.getState());
  const firstTab = state.activeTabId;
  assert.equal(state.tabs.find((tab) => tab.id === firstTab).error, undefined);
  let webPage = app
    .context()
    .pages()
    .find((candidate) => candidate.url() === `${origin}/`);
  assert.ok(webPage, "a real Chromium page was created");
  assert.deepEqual(
    await webPage.evaluate(() => ({
      node: typeof process,
      require: typeof require,
      bridge: typeof window.grove,
    })),
    { node: "undefined", require: "undefined", bridge: "undefined" },
  );
  checked(
    "real website navigation with Node and shell bridge unavailable to websites",
  );
  await webPage.evaluate(() => {
    localStorage.setItem("grove-isolation", "project-only");
    document.cookie = "grove_cookie=project-only; path=/; max-age=3600";
  });
  await webPage.locator("#next").click();
  await webPage.waitForURL(`${origin}/second`);
  await page.waitForFunction(() =>
    document
      .querySelector(".tab-row.active .tab-select")
      ?.textContent?.includes("Second page"),
  );
  await page.evaluate(
    (id) => window.grove.dispatch({ type: "tab:back", id }),
    firstTab,
  );
  await webPage.waitForURL(`${origin}/`);
  checked("native page navigation and back history");
  await page
    .getByRole("button", { name: "Bookmark this page", exact: true })
    .click();
  state = await page.evaluate(() => window.grove.getState());
  assert.ok(state.bookmarks.some((bookmark) => bookmark.url === `${origin}/`));
  checked("bookmark persistence from the toolbar");
  const before = state.tabs.map((tab) => tab.id);
  state = await page.evaluate(
    (url) =>
      window.grove.dispatch({ type: "tab:create", url, background: true }),
    `${origin}/second`,
  );
  const secondTab = state.tabs.find((tab) => !before.includes(tab.id)).id;
  await page.waitForFunction(async (id) => {
    const tab = (await window.grove.getState()).tabs.find((item) => item.id === id);
    return tab && tab.title === "Second page" && !tab.loading;
  }, secondTab);
  await page.evaluate(
    (id) => window.grove.dispatch({ type: "tab:split", id }),
    secondTab,
  );
  await page.waitForTimeout(200);
  const viewBounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .contentView.children.filter((view) => view.getVisible())
      .map((view) => view.getBounds()),
  );
  assert.equal(viewBounds.length, 2);
  assert.ok(viewBounds[0].width > 100 && viewBounds[1].width > 100);
  assert.ok(Math.abs(viewBounds[0].width - viewBounds[1].width) <= 1);
  checked("two native WebContentsView panes with balanced bounds");
  const paneBounds = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .contentView.children.filter((view) => view.getVisible())
      .map((view) => ({
        url: view.webContents.getURL(),
        bounds: view.getBounds(),
      })),
  );
  await app.evaluate(({ BrowserWindow }, url) => {
    BrowserWindow.getAllWindows()[0]
      .contentView.children.find((view) => view.webContents.getURL() === url)
      .webContents.focus();
  }, `${origin}/second`);
  await page.waitForFunction(
    async (id) => (await window.grove.getState()).activeTabId === id,
    secondTab,
  );
  await page.evaluate(() =>
    window.grove.dispatch({ type: "page:zoom", direction: "in" }),
  );
  const focusedZoom = await app.evaluate(
    ({ BrowserWindow }, url) =>
      BrowserWindow.getAllWindows()[0]
        .contentView.children.find((view) => view.webContents.getURL() === url)
        .webContents.getZoomLevel(),
    `${origin}/second`,
  );
  assert.equal(focusedZoom, 1);
  assert.deepEqual(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]
        .contentView.children.filter((view) => view.getVisible())
        .map((view) => ({
          url: view.webContents.getURL(),
          bounds: view.getBounds(),
        })),
    ),
    paneBounds,
  );
  await page.evaluate(() =>
    window.grove.dispatch({ type: "page:zoom", direction: "reset" }),
  );
  await app.evaluate(({ BrowserWindow }, url) => {
    BrowserWindow.getAllWindows()[0]
      .contentView.children.find((view) => view.webContents.getURL() === url)
      .webContents.focus();
  }, `${origin}/`);
  await page.waitForFunction(
    async (id) => (await window.grove.getState()).activeTabId === id,
    firstTab,
  );
  checked(
    "native split focus updates page controls while keeping pane positions stable",
  );
  await page.getByRole("button", { name: "Browser menu", exact: true }).click();
  await page.getByRole("heading", { name: "A few useful things" }).waitFor();
  await page.waitForTimeout(100);
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children.filter((view) =>
          view.getVisible(),
        ).length,
    ),
    0,
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  checked("native pages hide behind dialogs");
  await page.evaluate(
    (id) => window.grove.dispatch({ type: "tab:close", id }),
    firstTab,
  );
  state = await page.evaluate(() => window.grove.getState());
  assert.equal(state.activeTabId, secondTab);
  assert.equal(state.splitTabId, null);
  checked("closing the primary split pane promotes the remaining page");
  state = await page.evaluate(
    (url) =>
      window.grove.dispatch({ type: "tab:create", url, background: true }),
    `${origin}/second?comparison=1`,
  );
  const comparison = state.tabs.find(
    (tab) => tab.url === `${origin}/second?comparison=1`,
  ).id;
  await page.evaluate(
    (id) => window.grove.dispatch({ type: "tab:split", id }),
    comparison,
  );
  state = await page.evaluate(() =>
    window.grove.dispatch({ type: "tab:create" }),
  );
  assert.equal(state.splitTabId, null);
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children.filter((view) =>
          view.getVisible(),
        ).length,
    ),
    0,
  );
  await page.evaluate(
    (id) => window.grove.dispatch({ type: "tab:activate", id }),
    secondTab,
  );
  await page.evaluate(
    (id) => window.grove.dispatch({ type: "tab:split", id }),
    comparison,
  );
  state = await page.evaluate(
    (id) =>
      window.grove.dispatch({
        type: "tab:navigate",
        id,
        url: "grove://newtab",
      }),
    secondTab,
  );
  await page.waitForFunction(async (id) => {
    const current = await window.grove.getState();
    return (
      current.tabs.find((tab) => tab.id === id)?.url === "grove://newtab" &&
      !current.splitTabId
    );
  }, secondTab);
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children.filter((view) =>
          view.getVisible(),
        ).length,
    ),
    0,
  );
  checked(
    "new tabs and Home clear split views without resurrecting removed pages",
  );
  await page.evaluate(
    ({ id, url }) => window.grove.dispatch({ type: "tab:navigate", id, url }),
    { id: secondTab, url: `${origin}/recoverable` },
  );
  await page.waitForFunction(
    async (id) =>
      !!(await window.grove.getState()).tabs.find((tab) => tab.id === id)
        ?.error,
    secondTab,
  );
  state = await page.evaluate(() => window.grove.getState());
  assert.equal(
    state.tabs.find((tab) => tab.id === secondTab).url,
    `${origin}/recoverable`,
  );
  failRecoverablePage = false;
  await page.getByRole("button", { name: "Try again", exact: false }).click();
  await page.waitForFunction(async (id) => {
    const tab = (await window.grove.getState()).tabs.find(
      (tab) => tab.id === id,
    );
    return (
      tab && !tab.error && !tab.loading && tab.title === "Grove test garden"
    );
  }, secondTab);
  checked(
    "failed navigation keeps its destination and Try again recovers the intended page",
  );
  await page.evaluate(() =>
    window.grove.dispatch({ type: "space:activate", id: "personal" }),
  );
  state = await page.evaluate(
    (url) => window.grove.dispatch({ type: "tab:create", url }),
    origin,
  );
  const personalTab = state.activeTabId;
  await page.waitForFunction(() =>
    document
      .querySelector(".tab-row.active .tab-select")
      ?.textContent?.includes("Grove test garden"),
  );
  webPage = app
    .context()
    .pages()
    .filter((candidate) => candidate.url() === `${origin}/`)
    .at(-1);
  assert.equal(
    await webPage.evaluate(() => localStorage.getItem("grove-isolation")),
    null,
  );
  assert.equal(
    await webPage.evaluate(() => document.cookie.includes("grove_cookie")),
    false,
  );
  checked("cookies and local storage are isolated across personal spaces");
  await page.evaluate(() =>
    window.grove.dispatch({
      type: "settings:update",
      settings: { automationEnabled: true },
    }),
  );
  await page.waitForFunction(
    async () => (await window.grove.getState()).automation.running,
  );
  const connection = await page.evaluate(() =>
    window.grove.getAgentConnection(),
  );
  const api = async (path, method = "GET", body) =>
    fetch(connection.endpoint + path, {
      method,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal((await fetch(connection.endpoint + "/health")).status, 401);
  assert.equal((await api(`/tabs/${personalTab}/snapshot`)).status, 404);
  checked(
    "agent endpoint requires authentication and cannot access personal tabs",
  );
  const created = await (
    await api("/spaces", "POST", { name: "Research helper" })
  ).json();
  assert.ok(created.space?.id, JSON.stringify(created));
  const task = created.space.id;
  const opened = await (
    await api(`/spaces/${task}/tabs`, "POST", { url: origin })
  ).json();
  assert.ok(opened.tab?.id, JSON.stringify(opened));
  const agentTab = opened.tab.id;
  const snapshotResponse = await api(`/tabs/${agentTab}/snapshot`);
  const snapshot = await snapshotResponse.json();
  assert.equal(snapshotResponse.status, 200, JSON.stringify(snapshot));
  assert.match(snapshot.text, /Grove test garden/);
  assert.ok(snapshot.interactables.some((item) => item.selector === "#query"));
  state = await page.evaluate(() => window.grove.getState());
  assert.equal(state.activeTabId, personalTab);
  checked(
    "agent opens a background task and reads a real isolated-world snapshot",
  );
  let result = await api(`/tabs/${agentTab}/fill`, "POST", {
    selector: "#query",
    value: "Grove research complete",
  });
  assert.equal(result.status, 200, await result.text());
  result = await api(`/tabs/${agentTab}/click`, "POST", { selector: "#save" });
  assert.equal(result.status, 200, await result.text());
  const after = await (await api(`/tabs/${agentTab}/snapshot`)).json();
  assert.match(after.text, /Grove research complete/);
  checked("agent fills and clicks real page elements");
  assert.equal((await api(`/spaces/${task}/handoff`, "POST", {})).status, 200);
  assert.equal((await api(`/tabs/${agentTab}/snapshot`)).status, 409);
  await page.evaluate(
    (id) =>
      window.grove.dispatch({ type: "space:ownership", id, owner: "agent" }),
    task,
  );
  assert.equal((await api(`/tabs/${agentTab}/snapshot`)).status, 200);
  checked("human takeover blocks agent reads until explicit resume");
  state = await page.evaluate(() =>
    window.grove.dispatch({
      type: "space:create",
      name: "Manual task",
      kind: "agent",
      color: "purple",
    }),
  );
  const manual = state.activeSpaceId;
  assert.equal(
    state.spaces.find((space) => space.id === manual).owner,
    "human",
  );
  assert.equal((await api(`/spaces/${manual}/tabs`)).status, 404);
  await page.evaluate(
    (id) =>
      window.grove.dispatch({ type: "space:ownership", id, owner: "agent" }),
    manual,
  );
  assert.equal((await api(`/spaces/${manual}/tabs`)).status, 200);
  checked(
    "manually created agent spaces require an explicit grant to the running API",
  );
  await page.evaluate(() =>
    window.grove.dispatch({ type: "space:activate", id: "personal" }),
  );
  await page.evaluate(() => window.grove.dispatch({ type: "tab:create" }));
  await page.evaluate(() =>
    window.grove.dispatch({
      type: "settings:update",
      settings: { theme: "light", automationEnabled: false },
    }),
  );
  await page.waitForFunction(
    async () => !(await window.grove.getState()).automation.running,
  );
  if (process.env.GROVE_CAPTURE_SCREENSHOTS === "1") {
    await mkdir("docs/images", { recursive: true });
    await page.waitForTimeout(350);
    await page.screenshot({
      path: "docs/images/grove-light.png",
      scale: "css",
    });
    await page.evaluate(() =>
      window.grove.dispatch({
        type: "settings:update",
        settings: { theme: "dark" },
      }),
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: "docs/images/grove-dark.png", scale: "css" });
  }
  assert.deepEqual(errors, []);
  await app.close();
  app = undefined;
  const persisted = JSON.parse(
    await readFile(join(profile, "browser-state.json"), "utf8"),
  );
  assert.ok(persisted.spaces.some((space) => space.id === project));
  assert.ok(
    persisted.bookmarks.some((bookmark) => bookmark.url === `${origin}/`),
  );
  assert.ok(persisted.spaces.every((space) => space.kind === "personal"));
  assert.ok(!JSON.stringify(persisted).includes(connection.token));
  page = await launch();
  state = await page.evaluate(() => window.grove.getState());
  assert.ok(state.spaces.some((space) => space.id === project));
  assert.ok(state.spaces.every((space) => space.kind === "personal"));
  assert.ok(state.bookmarks.some((bookmark) => bookmark.url === `${origin}/`));
  checked(
    "restart restores personal state and excludes agent spaces and API secrets",
  );
  const cookieCount = await app.evaluate(
    async ({ session }, { project, origin }) =>
      (
        await session
          .fromPartition(`persist:space-${project}`)
          .cookies.get({ url: origin })
      ).length,
    { project, origin },
  );
  assert.ok(
    cookieCount > 0,
    "the unopened restored space has its existing cookies",
  );
  await page.evaluate(
    (id) => window.grove.dispatch({ type: "space:delete", id }),
    project,
  );
  assert.equal(
    await app.evaluate(
      async ({ session }, { project, origin }) =>
        (
          await session
            .fromPartition(`persist:space-${project}`)
            .cookies.get({ url: origin })
        ).length,
      { project, origin },
    ),
    0,
  );
  checked("deleting an unopened restored space clears its persistent cookies");
  if (process.platform === "darwin") {
    await page.evaluate(
      (url) => window.grove.dispatch({ type: "tab:create", url }),
      origin,
    );
    await page.waitForFunction(async () =>
      (await window.grove.getState()).tabs.some(
        (tab) => tab.title === "Grove test garden",
      ),
    );
    assert.equal(
      await app.evaluate(({ session }) =>
        session
          .fromPartition("persist:space-personal")
          .listenerCount("will-download"),
      ),
      1,
    );
    const nextWindow = app.waitForEvent("window", {
      predicate: async (candidate) => {
        try {
          await candidate.waitForFunction(() => !!window.grove, null, {
            timeout: 5000,
          });
          return true;
        } catch {
          return false;
        }
      },
    });
    const listenersAfterClose = await app.evaluate(
      ({ BrowserWindow, app, session }) => {
        BrowserWindow.getAllWindows()[0].close();
        const listeners = session
          .fromPartition("persist:space-personal")
          .listenerCount("will-download");
        setTimeout(() => app.emit("activate"), 50);
        return listeners;
      },
    );
    assert.equal(listenersAfterClose, 0);
    page = await nextWindow;
    await page.waitForFunction(
      async () =>
        !!window.grove &&
        (await window.grove.getState()).tabs.some(
          (tab) => tab.title === "Grove test garden",
        ),
    );
    assert.equal(
      await app.evaluate(({ session }) =>
        session
          .fromPartition("persist:space-personal")
          .listenerCount("will-download"),
      ),
      1,
    );
    checked(
      "macOS window recreation attaches exactly one session download listener",
    );
  }
  console.log(`Desktop smoke passed: ${checks} checks.`);
} finally {
  if (app) await app.close().catch(() => {});
  await new Promise((resolve) => fixture.close(resolve));
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 150,
  });
}
