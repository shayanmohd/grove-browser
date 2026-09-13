import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { chmod, mkdtemp, open, readFile, rm, symlink, writeFile } from "node:fs/promises";
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

  it("uploads exact selected bytes with basenames and MIME types, without disclosing local paths", async () => {
    const prefix = await connectionFile();
    const paths = [`${prefix}.aab`, `${prefix}.PNG`];
    const bytes = [Buffer.from([0, 255, 128, 65, 10]), Buffer.from([137, 80, 78, 71])];
    await Promise.all(paths.map((path, index) => writeFile(path, bytes[index])));
    const fetch = vi.fn(async () => Response.json({ ok: true, selected: 2 }));
    const stdout = sink();
    expect(await runCli(["upload", "tab-1", "@e3", ...paths], { env, fetch, stdout })).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url.href).toBe(`${env.GROVE_ENDPOINT}/tabs/tab-1/upload`);
    const payload = JSON.parse(options.body);
    expect(payload.ref).toBe("@e3");
    expect(payload.files).toEqual([
      { name: "connection.json.aab", type: "application/octet-stream", data: bytes[0].toString("base64") },
      { name: "connection.json.PNG", type: "image/png", data: bytes[1].toString("base64") },
    ]);
    expect(options.headers.Authorization).toBe(`Bearer ${env.GROVE_TOKEN}`);
    expect(options.redirect).toBe("error");
    for (const [index, path] of paths.entries()) {
      expect(options.body).not.toContain(path);
      expect(stdout.text()).not.toContain(path);
      expect(await readFile(path)).toEqual(bytes[index]);
    }
  });

  it("rejects upload selectors, directories, excess file counts, and aggregate size before connecting", async () => {
    const file = await connectionFile();
    const directory = await mkdtemp(join(tmpdir(), "grove-upload-directory-"));
    directories.push(directory);
    const fetch = vi.fn();
    for (const args of [
      ["upload", "tab-1", "#upload", file],
      ["upload", "tab-1", "@e0", file],
      ["upload", "tab-1", "@e1"],
      ["upload", "tab-1", "@e1", ...Array(9).fill(file)],
      ["upload", "tab-1", "@e1", directory],
    ])
      await expect(runCli(args, { env, fetch, stdout: sink() })).rejects.toThrow();
    const large = `${file}.aab`;
    const handle = await open(large, "w");
    await handle.truncate(16 * 1024 * 1024 + 1);
    await handle.close();
    await expect(runCli(["upload", "tab-1", "@e1", large], { env, fetch, stdout: sink() })).rejects.toThrow("16 MiB");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === "win32")("refuses symbolic links for selected upload files", async () => {
    const file = await connectionFile();
    const link = `${file}.png`;
    await symlink(file, link);
    const fetch = vi.fn();
    await expect(runCli(["upload", "tab-1", "@e1", link], { env, fetch, stdout: sink() })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not disclose selected local paths when a file cannot be read", async () => {
    const missing = `${await connectionFile()}.missing-private-bundle.aab`;
    const stderr = sink();
    const fetch = vi.fn();
    expect(await main(["upload", "tab-1", "@e1", missing], { env, fetch, stderr })).toBe(1);
    expect(stderr.text()).not.toContain(missing);
    expect(stderr.text()).not.toContain("missing-private-bundle");
    expect(fetch).not.toHaveBeenCalled();
  });
});
