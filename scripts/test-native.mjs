// Launches Kamapathy the way a person does, without Playwright, and drives an agent
// tab through its socket. Playwright's focus emulation marks every page it
// attaches to as visible, which hid agent pages that never painted: controls
// that animate in, native clicks, and screenshots all failed only outside tests.
import { prepareDesktopRuntime } from "./desktop-runtime.mjs";
import { poll } from "./wait.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  resolveSocket,
  socketFetch,
} from "../skills/kamapathy/scripts/kamapathy.mjs";

const page = (body, script = "") =>
  `<!doctype html><html><body style="margin:20px">${body}<script>${script}</script></body></html>`;
const pages = {
  "/animated": page(
    `<style>@keyframes fade{to{opacity:1}}#go{opacity:0;animation:fade .3s forwards}</style><button id="go">Animated button</button>`,
  ),
  "/frames": page(
    `<p id="frames">frames 0</p><button id="go" hidden>Frame button</button>`,
    `let count=0;const tick=()=>{count++;document.getElementById('frames').textContent='frames '+count;if(count===2)document.getElementById('go').hidden=false;requestAnimationFrame(tick)};requestAnimationFrame(tick);`,
  ),
  "/click": page(
    `<button id="go" onclick="this.textContent='clicked'">Click me</button>`,
  ),
  "/drag": page(
    `<div id="item" draggable="true" style="width:120px;padding:12px;border:1px solid">Drag me</div><div id="zone" style="margin-top:40px;width:240px;height:80px;border:1px dashed">Drop here</div>`,
    `document.getElementById('item').ondragstart=(event)=>event.dataTransfer.setData('text/plain','item');const zone=document.getElementById('zone');zone.ondragover=(event)=>event.preventDefault();zone.ondrop=(event)=>{event.preventDefault();zone.textContent='dropped '+event.dataTransfer.getData('text/plain');};`,
  ),
};
const site = createServer((request, response) => {
  const html = pages[new URL(request.url, "http://x").pathname];
  response.writeHead(html ? 200 : 404, { "Content-Type": "text/html" });
  response.end(html || "");
});
await new Promise((done) => site.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${site.address().port}`;
const profile = await mkdtemp(join(tmpdir(), "kamapathy-native-"));
const env = { ...process.env, KAMAPATHY_USER_DATA: profile, KAMAPATHY_NO_LAUNCH: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const kamapathy = spawn(await prepareDesktopRuntime(), [resolve("out/main/index.js")], {
  env,
  stdio: "ignore",
});
const checks = [];
const passed = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  const connection = await poll(() => resolveSocket(env).catch(() => null), {
    timeoutMs: 60000,
    label: "Kamapathy's agent socket",
  });
  const send = socketFetch(connection);
  const api = async (path, method = "GET", body) => {
    const response = await send(path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, response };
  };
  const json = async (...args) => (await api(...args)).response.json();
  passed("a normally launched Kamapathy accepts agents with no setup");
  const { space } = await json("/spaces", "POST", { name: "Native render" });
  const open = async (path) =>
    (await json(`/spaces/${space.id}/tabs`, "POST", { url: `${origin}${path}` }))
      .tab.id;
  const snapshot = (tab, extra = "") => json(`/tabs/${tab}/snapshot${extra}`);
  const controls = async (tab) =>
    (await snapshot(tab)).interactables.map((control) => control.label);

  const animated = await open("/animated");
  await poll(async () => (await controls(animated)).includes("Animated button"), {
    timeoutMs: 10000,
    label: "an animated control in an unwatched agent tab",
  });
  passed("controls that animate in become visible in an unwatched agent tab");

  const frames = await open("/frames");
  await poll(async () => (await controls(frames)).includes("Frame button"), {
    timeoutMs: 10000,
    label: "animation frames in an unwatched agent tab",
  });
  passed("unwatched agent tabs run animation frames");

  const click = await open("/click");
  await poll(async () => (await controls(click)).includes("Click me"), {
    timeoutMs: 10000,
    label: "the click fixture",
  });
  const clicked = await api(`/tabs/${click}/click`, "POST", { selector: "#go" });
  assert.equal(clicked.status, 200, JSON.stringify(await clicked.response.json()));
  assert.ok((await controls(click)).includes("clicked"));
  passed("native clicks reach an unwatched agent tab");

  const drag = await open("/drag");
  await poll(async () => (await controls(drag)).includes("Drag me"), {
    timeoutMs: 10000,
    label: "the drag fixture",
  });
  const dragged = await api(`/tabs/${drag}/drag`, "POST", {
    source: { selector: "#item" },
    target: { selector: "#zone" },
  });
  const dragResult = await dragged.response.json();
  assert.equal(dragged.status, 200, JSON.stringify(dragResult));
  assert.equal(dragResult.drag, "html5");
  assert.match((await snapshot(drag)).text, /dropped item/);
  passed("HTML5 drags reach an unwatched agent tab");

  const shot = await api(`/tabs/${click}/screenshot`);
  assert.equal(shot.status, 200);
  const png = Buffer.from(await shot.response.arrayBuffer());
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  passed("screenshots capture an unwatched agent tab");

  console.log(`Native launch passed: ${checks.length} checks.`);
} finally {
  kamapathy.kill();
  await new Promise((done) => (kamapathy.exitCode === null ? kamapathy.once("exit", done) : done()));
  site.close();
  site.closeAllConnections();
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
