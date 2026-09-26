export function menuKeyTarget(
  current: number,
  count: number,
  key: string,
): number | undefined {
  if (!count) return undefined;
  if (key === "ArrowDown") return current < 0 ? 0 : (current + 1) % count;
  if (key === "ArrowUp")
    return current < 0 ? count - 1 : (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return undefined;
}

export function gridMove(
  index: number,
  count: number,
  columns: number,
  key: string,
): number | undefined {
  if (!count) return undefined;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const row = Math.max(1, columns);
  const step: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: row,
    ArrowUp: -row,
  };
  if (!(key in step)) return undefined;
  return Math.max(0, Math.min(count - 1, index + step[key]));
}
