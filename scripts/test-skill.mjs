import { waitForState } from "./wait.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron } from "playwright";
import { startFormSite } from "../tests/fixtures/form-site.mjs";

const temporary = await mkdtemp(join(tmpdir(), "grove-skill-e2e-"));
const fixture = await startFormSite();
const skill = resolve(process.env.GROVE_SKILL_DIR || "skills/grove-browser");
const client = join(skill, "scripts/grove.mjs");
const skillText = await readFile(join(skill, "SKILL.md"), "utf8");
assert.ok(skillText.includes("GROVE_CONNECTION_FILE"));
const environment = {
  ...process.env,
  GROVE_USER_DATA: join(temporary, "profile"),
};
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.GROVE_ENDPOINT;
delete environment.GROVE_TOKEN;
const checks = [];
const calls = [];
let browser;
let chrome;
const artifacts = resolve("artifacts/review");
await mkdir(artifacts, { recursive: true });
function passed(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function cli(args, input, options = {}) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [client, ...args], {
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      errors = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Client timed out: ${args[0]}`));
    }, 80000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, errors });
    });
    child.stdin.end(
      input === undefined
        ? undefined
        : typeof input === "string"
          ? input
          : JSON.stringify(input),
    );
  });
  calls.push({
    command: args[0],
    code: result.code,
    outputCharacters: result.output.length,
  });
  if (!options.failure)
    assert.equal(
      result.code,
      0,
      `${args[0]} failed: ${result.errors || result.output}`,
    );
  else assert.notEqual(result.code, 0, `${args[0]} unexpectedly succeeded`);
  return result;
}
async function json(args, input) {
  return JSON.parse((await cli([...args, "--json"], input)).output);
}
const observe = (id) => json(["snapshot", id, "--full"]);
function ref(snapshot, label, tag) {
  const matches = snapshot.interactables.filter(
    (control) => control.label === label && (!tag || control.tag === tag),
  );
  assert.equal(matches.length, 1, `Expected one control labeled ${label}`);
  return matches[0].ref;
}
const fill = (reference, value) => ({ type: "fill", ref: reference, value });
const click = (reference) => ({ type: "click", ref: reference });
const wait = (selector, text) => ({
  type: "wait",
  selector,
  ...(text ? { text } : {}),
  timeoutMs: 5000,
});
try {
  browser = await electron.launch({
    ...(process.env.GROVE_EXECUTABLE
      ? { executablePath: resolve(process.env.GROVE_EXECUTABLE) }
      : {}),
    args: process.env.GROVE_EXECUTABLE ? [] : [resolve("out/main/index.js")],
    env: environment,
  });
  chrome = await browser.firstWindow();
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
  environment.GROVE_CONNECTION_FILE = join(temporary, "connection.json");
  await writeFile(
    environment.GROVE_CONNECTION_FILE,
    JSON.stringify(connection),
    { mode: 0o600 },
  );
  assert.equal((await cli(["health"])).output.trim(), "ok Grove 0.1.0");
  passed("standalone skill client connects using protected credentials");
  const original = (await chrome.evaluate(() => window.grove.getState()))
    .activeTabId;
  const { space } = await json(["space", "create", "Skill form review"]);
  const { tab } = await json(["open", space.id, `${fixture.origin}/forms/new`]);
  const initial = await observe(tab.id);
  assert.match(initial.title, /Create a form/);
  assert.ok(
    initial.interactables.every((control) => control.type !== "hidden"),
  );
  await writeFile(
    join(artifacts, "grove-form.txt"),
    (await cli(["snapshot", tab.id, "--full"])).output,
  );
  passed("compact observation exposes labeled controls and hides CSRF fields");
  const creation = await json(
    ["batch", tab.id],
    [
      fill(ref(initial, "Form title"), "Release feedback"),
      fill(ref(initial, "Description"), "Local end-to-end browser review"),
      fill(ref(initial, "Template"), "feedback"),
      click(ref(initial, "Create form")),
      wait("#response-form"),
      { type: "snapshot", mode: "full" },
    ],
  );
  assert.equal(creation.ok, true);
  assert.equal(fixture.forms.size, 1);
  const created = creation.results.at(-1).result;
  assert.match(created.text, /Form created/);
  await writeFile(
    join(artifacts, "grove-created-form.txt"),
    (await cli(["snapshot", tab.id, "--full"])).output,
  );
  passed(
    "skill batch creates a form through a real POST and follows its redirect",
  );
  await cli(["click", tab.id, ref(created, "Submit response")]);
  assert.equal(fixture.submissions.length, 0);
  passed("native required-field validation blocks incomplete submission");
  await json(
    ["batch", tab.id],
    [
      fill(ref(created, "Your name"), "Browser Reviewer"),
      fill(ref(created, "Email address"), "reviewer@example.test"),
      fill(ref(created, "Topic"), "automation"),
      click(ref(created, "High")),
      fill(
        ref(created, "Your feedback"),
        "The local form workflow completed through the browser skill.",
      ),
      click(ref(created, "Add project context")),
      wait("#context"),
    ],
  );
  const withContext = await observe(tab.id);
  const submission = await json(
    ["batch", tab.id],
    [
      fill(
        ref(withContext, "Project context"),
        "Cross-platform portfolio review",
      ),
      click(ref(withContext, "I agree to submit this local test response")),
      click(ref(withContext, "Submit response")),
      wait("#confirmation", "Submission received"),
      { type: "snapshot", mode: "full" },
    ],
  );
  assert.equal(submission.ok, true);
  assert.equal(fixture.submissions.length, 1);
  assert.deepEqual(fixture.submissions[0], {
    id: "receipt-1",
    formId: "form-1",
    name: "Browser Reviewer",
    email: "reviewer@example.test",
    topic: "automation",
    notes: "The local form workflow completed through the browser skill.",
    priority: "high",
    context: "Cross-platform portfolio review",
  });
  assert.match(submission.results.at(-1).result.text, /Submission received/);
  await writeFile(
    join(artifacts, "grove-receipt.txt"),
    (await cli(["snapshot", tab.id, "--full"])).output,
  );
  assert.equal(
    (await chrome.evaluate(() => window.grove.getState())).activeTabId,
    original,
  );
  passed(
    "dynamic fields, select, radio, checkbox and textarea submit once without stealing the active tab",
  );
  const stale = await cli(
    ["fill", tab.id, ref(created, "Your name"), "--stdin"],
    "Wrong page",
    { failure: true },
  );
  assert.match(stale.errors, /stale|reference/i);
  passed("refs from the previous document are rejected after a redirect");
  await json(["navigate", tab.id, `${fixture.origin}/lab`]);
  let lab = await observe(tab.id);
  assert.ok(!JSON.stringify(lab).includes("hidden-fixture-value"));
  const oldField = ref(lab, "Replaceable field");
  await cli(["click", tab.id, ref(lab, "Replace control")]);
  const detached = await cli(
    ["fill", tab.id, oldField, "--stdin"],
    "Do not retarget",
    { failure: true },
  );
  assert.match(detached.errors, /stale|reference|detached/i);
  passed("detached refs cannot silently target replacement controls");
  lab = await observe(tab.id);
  await cli(
    ["fill", tab.id, ref(lab, "Read only input"), "--stdin"],
    "Should fail",
    { failure: true },
  );
  await cli(["click", tab.id, ref(lab, "Disabled action")], undefined, {
    failure: true,
  });
  passed("disabled and read-only controls fail with actionable errors");
  await cli(
    ["fill", tab.id, ref(lab, "Editable note"), "--stdin"],
    "Edited through the skill",
  );
  const scoped = await json(["snapshot", tab.id, "--selector", "#editable"]);
  assert.equal(scoped.text, "");
  assert.ok(!scoped.text.includes("Interaction lab"));
  assert.equal(
    (await json(["snapshot", tab.id, "--selector", "#editable-result"])).text,
    "Edited through the skill",
  );
  passed(
    "contenteditable fill is verified by the page while draft values stay out of snapshots",
  );
  const partial = await cli(
    ["batch", tab.id, "--json"],
    [
      fill(ref(lab, "Replacement field"), "First action completed"),
      click(ref(lab, "Disabled action")),
      click(ref(lab, "Show delayed result")),
    ],
    { failure: true },
  );
  const partialResult = JSON.parse(partial.output);
  assert.equal(partialResult.ok, false);
  assert.equal(partialResult.failedIndex, 1);
  assert.equal(partialResult.results.length, 1);
  assert.ok(!(await observe(tab.id)).text.includes("Delayed content ready"));
  passed("batch failure returns partial progress and stops subsequent actions");
  await json(
    ["batch", tab.id],
    [
      click(ref(lab, "Show delayed result")),
      wait("#delayed-result", "Delayed content ready"),
    ],
  );
  await cli(
    ["wait", tab.id, "--stdin"],
    { selector: "#does-not-exist", timeoutMs: 100 },
    { failure: true },
  );
  passed(
    "bounded waits observe asynchronous content and time out on missing conditions",
  );
  await cli(["scroll", tab.id, "down", "600"]);
  await cli(["click", tab.id, ref(lab, "Bottom action")]);
  assert.match(
    (await json(["snapshot", tab.id, "--selector", "#bottom-result"])).text,
    /Bottom action completed/,
  );
  passed("scrolling and offscreen control clicks target the correct element");
  await cli(
    ["fill", tab.id, ref(lab, "Search fixture", "input"), "--stdin"],
    "keyboard submission",
  );
  await cli(["press", tab.id, "Enter", ref(lab, "Search fixture", "input")]);
  await cli(["wait", tab.id, "--stdin"], {
    selector: "#enter-result",
    text: "keyboard submission",
    timeoutMs: 5000,
  });
  passed("trusted Enter key submits a native form and follows navigation");
  const png = join(temporary, "viewport.png");
  await cli(["screenshot", tab.id, png]);
  const image = await readFile(png);
  assert.deepEqual(
    [...image.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  assert.ok(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0);
  await cli(["screenshot", tab.id, png], undefined, { failure: true });
  passed(
    "viewport screenshots contain a real PNG and do not overwrite existing files",
  );
  await cli(["handoff", space.id]);
  await cli(["snapshot", tab.id], undefined, { failure: true });
  await cli(["click", tab.id, "#enter-result"], undefined, { failure: true });
  await chrome.evaluate(
    (id) =>
      window.grove.dispatch({ type: "space:ownership", id, owner: "agent" }),
    space.id,
  );
  await observe(tab.id);
  passed(
    "human handoff blocks skill reads and actions until explicit UI resume",
  );
  await json(["navigate", tab.id, `${fixture.origin}/benchmark`]);
  const reference = await observe(tab.id);
  assert.equal(reference.truncated, false);
  assert.match(reference.text, /Research note 18/);
  assert.ok(
    reference.interactables.some((control) => control.label === "Read note 18"),
  );
  await writeFile(
    join(artifacts, "grove-reference.txt"),
    (await cli(["snapshot", tab.id, "--full"])).output,
  );
  passed(
    "full-content observation retains every reference page note and control",
  );
  await json(["navigate", tab.id, `${fixture.origin}/edges`]);
  const edges = await observe(tab.id);
  assert.ok(!JSON.stringify(edges).includes("secret"));
  assert.ok(
    !edges.interactables.some(
      (control) => control.label === "Invisible button",
    ),
  );
  assert.ok(!edges.text.includes("Disclosure revealed"));
  assert.match(edges.text, /Visible start\s+Visible end/);
  ref(edges, "Save caption");
  ref(edges, "Action caption");
  const choice = edges.interactables.find(
    (control) => control.label === "Option choice",
  );
  assert.ok(
    choice.options.some(
      (option) => option.value === "blocked" && option.disabled,
    ),
  );
  assert.ok(
    (await cli(["snapshot", tab.id, "--selector", "#choice"])).output.includes(
      '"last": "Last"',
    ),
  );
  passed(
    "snapshots exclude hidden content and drafts, retain line breaks and label input buttons",
  );
  await cli(["click", tab.id, ref(edges, "Open details")]);
  await cli(["wait", tab.id, "--stdin"], {
    text: "Disclosure revealed",
    timeoutMs: 1000,
  });
  passed("summary disclosures are discoverable and clickable through refs");
  for (const label of ["Rich editor", "Plain editor"]) {
    await cli(
      ["fill", tab.id, ref(edges, label), "--stdin"],
      "Unicode café 🌱\nsecond line",
    );
    const echoed = await json([
      "snapshot",
      tab.id,
      "--selector",
      "#field-result",
    ]);
    assert.match(echoed.text, /Unicode café 🌱\s+second line/);
  }
  passed(
    "empty and plaintext-only contenteditable fields accept Unicode and multiline text",
  );
  for (const [label, value] of [
    ["Numeric input", "not a number"],
    ["Date input", "2026-02-30"],
    ["Range input", "42"],
    ["Color input", "#ffffff"],
    ["Option choice", "blocked"],
    ["Option choice", "duplicate"],
    ["Multiple choices", "a"],
    ["Becomes read only", "changed"],
    ["Replaced on focus", "changed"],
  ]) {
    await cli(["fill", tab.id, ref(edges, label), "--stdin"], value, {
      failure: true,
    });
    assert.ok(
      !(
        await json(["snapshot", tab.id, "--selector", "#field-result"])
      ).text.includes("=changed"),
    );
  }
  passed(
    "invalid values, unsupported fields, disabled option groups, duplicate options and focus mutations fail safely",
  );
  for (const [label, value, expected] of [
    ["Numeric input", "42", "numeric=42"],
    ["Date input", "2026-09-12", "date=2026-09-12"],
    ["Option choice", "last", "choice=last"],
  ]) {
    await cli(["fill", tab.id, ref(edges, label), "--stdin"], value);
    assert.equal(
      (await json(["snapshot", tab.id, "--selector", "#field-result"])).text,
      expected,
    );
  }
  passed("valid numeric, date and single select fills update the actual page");
  for (const [field, button, type] of [
    ["Popup message", "Submit popup", "application/x-www-form-urlencoded"],
    ["Multipart message", "Submit multipart", "multipart/form-data"],
  ]) {
    const message = `${field}: café 🌱 & = +`;
    const before = (await json(["tabs", space.id])).tabs.map((item) => item.id);
    await json(
      ["batch", tab.id],
      [fill(ref(edges, field), message), click(ref(edges, button))],
    );
    const popup = (await json(["tabs", space.id])).tabs.find(
      (item) => !before.includes(item.id),
    );
    assert.ok(popup, "Submission opens one new agent tab");
    await cli(["wait", popup.id, "--stdin"], {
      selector: "#popup-confirmation",
      timeoutMs: 5000,
    });
    assert.ok((await observe(popup.id)).text.includes(message));
    const receipt = fixture.events
      .filter((event) => event.type === "popup-submitted")
      .at(-1);
    assert.equal(receipt.method, "POST");
    assert.deepEqual(receipt.fields, { message });
    assert.ok(receipt.contentType.startsWith(type));
    assert.equal(receipt.referer, `${fixture.origin}/edges`);
    assert.equal(
      (await chrome.evaluate(() => window.grove.getState())).activeTabId,
      original,
    );
    await cli(["close", popup.id]);
  }
  assert.equal(
    fixture.events.filter((event) => event.type === "popup-submitted").length,
    2,
  );
  passed(
    "new-tab forms preserve encoded and multipart POST bodies, referrers and background ownership exactly once",
  );
  if (process.env.GROVE_TEST_PUBLIC === "1") {
    for (const [url, expected] of [
      ["https://example.com", /Example Domain/],
      ["https://developer.mozilla.org/en-US/", /MDN|Mozilla/],
      ["https://www.wikipedia.org", /Wikipedia/],
    ]) {
      await json(["navigate", tab.id, url]);
      const snapshot = await observe(tab.id);
      assert.match(snapshot.title + snapshot.text, expected);
      passed(
        `public website reads through the skill: ${new URL(url).hostname}`,
      );
    }
  }
  await cli(["space", "close", space.id]);
  assert.equal((await json(["spaces"])).spaces.length, 0);
  passed("skill cleanup closes only its own agent space");
  const summary = {
    date: new Date().toISOString(),
    platform: process.platform,
    skill: "grove-browser",
    checks,
    commandCalls: calls.length,
    formPosts: fixture.forms.size,
    responsePosts: fixture.submissions.length,
    publicWebsites: process.env.GROVE_TEST_PUBLIC === "1",
  };
  await writeFile(
    join(artifacts, "skill-results.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    `Skill end-to-end passed: ${checks.length} checks, ${calls.length} client commands, one form and one response created.`,
  );
} finally {
  if (browser) await browser.close().catch(() => {});
  await fixture.close();
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 150,
  });
}
