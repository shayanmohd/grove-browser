import { describe, expect, it, vi } from "vitest";
import { poll, waitForState } from "../scripts/wait.mjs";

describe("asynchronous desktop state waits", () => {
  it("continues polling when a promise resolves to false", async () => {
    const check = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue("ready");
    expect(await poll(check, { intervalMs: 1, timeoutMs: 1000 })).toBe("ready");
    expect(check).toHaveBeenCalledTimes(3);
  });
  it("waits for the requested state rather than accepting a pending IPC promise", async () => {
    const page = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce({ loading: true })
        .mockResolvedValueOnce({ loading: false }),
    };
    expect(
      await waitForState(page, (state) => !state.loading, undefined, {
        intervalMs: 1,
        timeoutMs: 1000,
      }),
    ).toEqual({ loading: false });
    expect(page.evaluate).toHaveBeenCalledTimes(2);
  });
  it("bounds a condition that never resolves", async () => {
    await expect(
      poll(() => new Promise(() => {}), {
        timeoutMs: 20,
        label: "stalled IPC",
      }),
    ).rejects.toThrow("stalled IPC");
  });
  it("preserves errors from the condition", async () => {
    await expect(
      poll(async () => {
        throw new Error("Browser closed");
      }),
    ).rejects.toThrow("Browser closed");
  });
});
