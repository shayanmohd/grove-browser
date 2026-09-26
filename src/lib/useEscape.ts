import { useEffect, useLayoutEffect, useRef } from "react";

// Listens on the document so Escape still closes the overlay after the
// focused element inside it disappears.
export function useEscape(active: boolean, onEscape: () => void): void {
  const latest = useRef(onEscape);
  useLayoutEffect(() => {
    latest.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current();
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [active]);
}
