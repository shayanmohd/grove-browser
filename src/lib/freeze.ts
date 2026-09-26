import type { FrozenFrame, KamapathyBridge } from "../../shared/types";

// Each capture gives up after 300ms in the main process; this also covers a
// reply that never arrives.
export const FREEZE_WAIT = 400;

export async function freezePage(
  bridge: Pick<KamapathyBridge, "freeze">,
  wait = FREEZE_WAIT,
): Promise<FrozenFrame[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      bridge.freeze().catch(() => []),
      new Promise<FrozenFrame[]>((resolve) => {
        timer = setTimeout(() => resolve([]), wait);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export interface FreezeHost {
  bridge: Pick<KamapathyBridge, "freeze" | "hidePages" | "unfreeze">;
  decode: (frames: FrozenFrame[]) => Promise<void>;
  painted: () => Promise<void>;
}

// Native pages draw above the shell, so an overlay opens over still frames of
// them: capture, draw the frames, then hide the pages. Closing shows the pages
// before it removes the frames, so the page area is never blank.
export class Freezer {
  private sequence = 0;
  private covers = 0;
  private covered = false;
  private hidden = false;

  constructor(private readonly host: FreezeHost) {}

  // `show` gets the frames to draw, or nothing when the current ones stay.
  // Resolves false when a later open() or close() overtook this one.
  async open(show: (frames?: FrozenFrame[]) => void): Promise<boolean> {
    const token = ++this.sequence;
    if (this.covered) {
      show();
      return true;
    }
    const frames = await freezePage(this.host.bridge);
    if (token !== this.sequence) return false;
    await this.host.decode(frames);
    if (token !== this.sequence) return false;
    this.covered = true;
    const cover = ++this.covers;
    show(frames);
    await this.host.painted();
    // Moving to another overlay keeps this cover; a close ends it.
    if (this.covered && cover === this.covers && !this.hidden) {
      this.hidden = true;
      this.host.bridge.hidePages();
    }
    return true;
  }

  // Waits for the current handler to finish, so an open() right after this,
  // as when a menu item opens a dialog, keeps the frames and hidden pages.
  close(clear: () => void): void {
    const token = ++this.sequence;
    if (!this.covered) return;
    queueMicrotask(async () => {
      if (token !== this.sequence) return;
      this.covered = false;
      if (this.hidden) {
        this.hidden = false;
        await this.host.bridge.unfreeze();
      }
      await this.host.painted();
      if (token === this.sequence) clear();
    });
  }
}

// Decoded images appear in the same paint that adds them.
export async function decodeFrames(frames: FrozenFrame[]): Promise<void> {
  await Promise.all(
    frames.map((frame) => {
      const image = new Image();
      image.src = frame.image;
      return image.decode().catch(() => {});
    }),
  );
}

// The first callback runs before the paint of what React just committed, the
// second after it.
export function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
