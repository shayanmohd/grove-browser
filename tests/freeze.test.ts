import { afterEach, describe, expect, it, vi } from "vitest";
import type { FrozenFrame } from "../shared/types";
import { Freezer, freezePage } from "../src/lib/freeze";

const frame: FrozenFrame = {
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  image: "data:image/jpeg;base64,AA==",
};
afterEach(() => vi.useRealTimers());

describe("freezePage", () => {
  it("returns the frames the main process captured", async () => {
    expect(await freezePage({ freeze: async () => [frame] })).toEqual([frame]);
  });
  it("shows an empty page area when the capture fails", async () => {
    expect(
      await freezePage({
        freeze: async () => {
          throw new Error("gone");
        },
      }),
    ).toEqual([]);
  });
  it("stops waiting for a reply that never comes", async () => {
    vi.useFakeTimers();
    const pending = freezePage({ freeze: () => new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(400);
    expect(await pending).toEqual([]);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
// Lets pending promise callbacks and queued microtasks run.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Records every step a freeze takes, in order.
function setup() {
  const events: string[] = [];
  const captures: (() => Promise<FrozenFrame[]>)[] = [];
  let paint: Promise<void> | undefined;
  const freezer = new Freezer({
    bridge: {
      freeze: () => {
        events.push("capture");
        return (captures.shift() ?? (async () => [frame]))();
      },
      hidePages: () => {
        events.push("hide");
      },
      unfreeze: async () => {
        events.push("unfreeze");
      },
    },
    decode: async () => {
      events.push("decode");
    },
    painted: () => {
      events.push("paint");
      return paint ?? Promise.resolve();
    },
  });
  return {
    freezer,
    events,
    captures,
    show: (frames?: FrozenFrame[]) => {
      events.push(frames ? `draw ${frames.length}` : "keep");
    },
    clear: () => {
      events.push("clear");
    },
    holdPaint: (next: Promise<void> | undefined) => {
      paint = next;
    },
  };
}

describe("Freezer", () => {
  it("draws the frames before hiding the pages, and shows the pages before removing the frames", async () => {
    const { freezer, events, show, clear } = setup();
    expect(await freezer.open(show)).toBe(true);
    expect(events).toEqual(["capture", "decode", "draw 1", "paint", "hide"]);
    events.length = 0;
    freezer.close(clear);
    await settle();
    expect(events).toEqual(["unfreeze", "paint", "clear"]);
  });

  it("keeps the frames and the hidden pages when a close and an open share a handler", async () => {
    const { freezer, events, show, clear } = setup();
    await freezer.open(show);
    events.length = 0;
    freezer.close(clear);
    expect(await freezer.open(show)).toBe(true);
    await settle();
    expect(events).toEqual(["keep"]);
  });

  it("drops an open that a close overtook while it captured", async () => {
    const { freezer, events, captures, show, clear } = setup();
    const capture = deferred<FrozenFrame[]>();
    captures.push(() => capture.promise);
    const pending = freezer.open(show);
    freezer.close(clear);
    capture.resolve([frame]);
    expect(await pending).toBe(false);
    await settle();
    expect(events).toEqual(["capture"]);
  });

  it("opens once for a double click, with the later capture", async () => {
    const { freezer, events, captures, show } = setup();
    const first = deferred<FrozenFrame[]>();
    captures.push(
      () => first.promise,
      async () => [frame, frame],
    );
    const slow = freezer.open(show);
    const fast = freezer.open(show);
    expect(await fast).toBe(true);
    first.resolve([frame]);
    expect(await slow).toBe(false);
    expect(events.filter((event) => event.startsWith("draw"))).toEqual([
      "draw 2",
    ]);
    expect(events.filter((event) => event === "hide")).toHaveLength(1);
  });

  it("leaves the pages live when the overlay closes before its frames were painted", async () => {
    const { freezer, events, show, clear, holdPaint } = setup();
    const paint = deferred<void>();
    holdPaint(paint.promise);
    const pending = freezer.open(show);
    await settle();
    expect(events).toContain("draw 1");
    freezer.close(clear);
    holdPaint(undefined);
    paint.resolve();
    await pending;
    await settle();
    expect(events).not.toContain("hide");
    expect(events).not.toContain("unfreeze");
    expect(events.at(-1)).toBe("clear");
  });

  it("still hides the pages when another overlay replaced the first before its paint", async () => {
    const { freezer, events, show, clear, holdPaint } = setup();
    const paint = deferred<void>();
    holdPaint(paint.promise);
    const pending = freezer.open(show);
    await settle();
    freezer.close(clear);
    await freezer.open(show);
    paint.resolve();
    await pending;
    await settle();
    expect(events.filter((event) => event === "hide")).toHaveLength(1);
    expect(events).not.toContain("clear");
  });

  it("ignores a paint from an overlay that already closed", async () => {
    const { freezer, events, show, clear, holdPaint } = setup();
    const first = deferred<void>();
    holdPaint(first.promise);
    const stale = freezer.open(show);
    await settle();
    freezer.close(clear);
    holdPaint(undefined);
    await settle();
    const second = deferred<void>();
    holdPaint(second.promise);
    const current = freezer.open(show);
    await settle();
    first.resolve();
    await stale;
    expect(events).not.toContain("hide");
    second.resolve();
    await current;
    expect(events.filter((event) => event === "hide")).toHaveLength(1);
  });

  it("hides the pages without frames when the capture fails", async () => {
    const { freezer, events, captures, show } = setup();
    captures.push(() => Promise.reject(new Error("gone")));
    await freezer.open(show);
    expect(events).toEqual(["capture", "decode", "draw 0", "paint", "hide"]);
  });
});
