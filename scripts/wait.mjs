import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

export async function poll(
  check,
  { timeoutMs = 30000, intervalMs = 50, label = "condition" } = {},
) {
  const deadline = performance.now() + timeoutMs;
  const expired = () =>
    new Error(`Timed out waiting for ${label} after ${timeoutMs} ms.`);
  while (true) {
    let timer;
    let result;
    try {
      result = await Promise.race([
        Promise.resolve().then(check),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(expired()),
            Math.max(0, deadline - performance.now()),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    if (result) return result;
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw expired();
    await sleep(Math.min(intervalMs, remaining));
  }
}

export async function waitForState(page, predicate, argument, options) {
  return poll(
    async () => {
      const state = await page.evaluate(() => window.grove.getState());
      return (await predicate(state, argument)) ? state : null;
    },
    { label: "browser state", ...options },
  );
}
