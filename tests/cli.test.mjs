import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  main,
  readConnection,
  runCli,
} from "../skills/grove-browser/scripts/grove.mjs";

const env = {
  GROVE_ENDPOINT: "http://127.0.0.1:12345",
  GROVE_TOKEN: "a".repeat(64),
};
const directories = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
const sink = () => {
  const output = [];
  return { write: (value) => output.push(value), text: () => output.join("") };
};
async function connectionFile() {
  const directory = await mkdtemp(join(tmpdir(), "grove-cli-test-"));
  directories.push(directory);
  const path = join(directory, "connection.json");
  await writeFile(
    path,
    JSON.stringify({ endpoint: env.GROVE_ENDPOINT, token: env.GROVE_TOKEN }),
    { mode: 0o600 },
  );
  return path;
}

describe("standalone skill client", () => {
  it("shows help without connecting or reading credentials", async () => {
    const fetch = vi.fn();
    const stdout = sink();
    expect(await runCli(["help"], { env: {}, fetch, stdout })).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(stdout.text()).toContain("batch");
  });
  it("reads a protected connection file and refuses mixed partial credentials", async () => {
    const path = await connectionFile();
    expect((await readConnection({ GROVE_CONNECTION_FILE: path })).token).toBe(
      env.GROVE_TOKEN,
    );
    await expect(
      readConnection({
        GROVE_CONNECTION_FILE: path,
        GROVE_ENDPOINT: env.GROVE_ENDPOINT,
      }),
    ).rejects.toThrow("64-character");
  });
  it.skipIf(process.platform === "win32")(
    "refuses readable-by-others credential files and symbolic links",
    async () => {
      const path = await connectionFile();
      await chmod(path, 0o644);
      await expect(
        readConnection({ GROVE_CONNECTION_FILE: path }),
      ).rejects.toThrow("0600");
      await chmod(path, 0o600);
      const link = `${path}.link`;
      await symlink(path, link);
      await expect(
        readConnection({ GROVE_CONNECTION_FILE: link }),
      ).rejects.toThrow();
    },
  );
  it("rejects remote endpoints and URL credentials before sending a request", async () => {
    for (const endpoint of [
      "https://example.com",
      "http://127.0.0.1:12345/path",
      "http://user:pass@127.0.0.1:12345",
      "http://localhost:12345",
    ])
      await expect(
        readConnection({ ...env, GROVE_ENDPOINT: endpoint }),
      ).rejects.toThrow("GROVE_ENDPOINT");
  });
  it("preserves exact stdin values and uses one authenticated request with redirects disabled", async () => {
    const value = 'Quoted "value" with a newline\n';
    const fetch = vi.fn(async () => Response.json({ ok: true }));
    expect(
      await runCli(["fill", "tab-1", "@e2", "--stdin"], {
        env,
        fetch,
        stdin: Readable.from([value]),
        stdout: sink(),
      }),
    ).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url.href).toBe(`${env.GROVE_ENDPOINT}/tabs/tab-1/fill`);
    expect(JSON.parse(options.body)).toEqual({ ref: "@e2", value });
    expect(options.headers.Authorization).toBe(`Bearer ${env.GROVE_TOKEN}`);
    expect(options.redirect).toBe("error");
  });
  it("returns partial batch progress with a failing exit code and never retries", async () => {
    const result = {
      ok: false,
      failedIndex: 1,
      results: [{ index: 0, type: "fill", result: { ok: true } }],
      error: { code: "stale_ref", message: "Observe again." },
    };
    const fetch = vi.fn(async () => Response.json(result, { status: 422 }));
    const stdout = sink();
    expect(
      await runCli(["batch", "tab-1", "--json"], {
        env,
        fetch,
        stdin: Readable.from([
          JSON.stringify([
            { type: "fill", ref: "@e1", value: "A" },
            { type: "click", ref: "@e2" },
          ]),
        ]),
        stdout,
      }),
    ).toBe(1);
    expect(JSON.parse(stdout.text())).toEqual(result);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("reports ambiguous timeouts without retrying a possible submission", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("Timed out", "TimeoutError");
    });
    const stderr = sink();
    expect(await main(["click", "tab-1", "@e1"], { env, fetch, stderr })).toBe(
      1,
    );
    expect(stderr.text()).toContain("Inspect the page before retrying");
    expect(stderr.text()).not.toContain(env.GROVE_TOKEN);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("never overwrites an existing screenshot", async () => {
    const path = `${await connectionFile()}.png`;
    await writeFile(path, "original");
    const fetch = vi.fn(
      async () =>
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { "Content-Type": "image/png" },
        }),
    );
    await expect(
      runCli(["screenshot", "tab-1", path], { env, fetch, stdout: sink() }),
    ).rejects.toThrow("EEXIST");
  });
});
