import { useEffect, useState } from "react";
import type { Activity } from "../../shared/types";
import { isAgentAction, RECENT_ACTION_MS } from "./spaces";

// Re-renders when the latest agent action stops counting as recent.
export function useAgentClock(activity: Activity[]): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const current = Date.now();
    setNow(current);
    const latest = activity.find(isAgentAction);
    const remaining = latest ? latest.time + RECENT_ACTION_MS - current : 0;
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), remaining + 20);
    return () => clearTimeout(timer);
  }, [activity]);
  return now;
}
