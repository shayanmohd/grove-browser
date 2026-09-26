import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { menuKeyTarget } from "../lib/navigation";
import { useEscape } from "../lib/useEscape";
import "./Popover.css";

const menuItems = (panel: HTMLElement) => [
  ...panel.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)'),
];

export function Popover({
  open,
  onClose,
  anchor,
  label,
  align = "start",
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  label: string;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });
  useEscape(open, onClose);
  useLayoutEffect(() => {
    const rect = open ? anchor.current?.getBoundingClientRect() : undefined;
    if (!rect) return;
    setPosition(
      align === "end"
        ? { top: rect.bottom + 6, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 6, left: rect.left },
    );
  }, [open, align, anchor]);
  useEffect(() => {
    if (!open || !panel.current) return;
    const trigger = anchor.current;
    (
      panel.current.querySelector<HTMLElement>("[data-autofocus]") ??
      menuItems(panel.current)[0]
    )?.focus();
    // Another popover's trigger opens its popover over the same still frame,
    // so closing here first would show the live page for a moment.
    function pointer(event: PointerEvent) {
      const target = event.target as Element;
      if (
        !panel.current?.contains(target) &&
        !trigger?.contains(target) &&
        !target.closest?.("[aria-haspopup]")
      )
        closeRef.current();
    }
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      // The menu is already gone, so focus is on the body unless what an item
      // opened (the find pill, the address bar, a dialog's field) took it.
      const active = document.activeElement;
      if (trigger?.isConnected && (!active || active === document.body))
        trigger.focus();
    };
  }, [open, anchor]);
  if (!open) return null;
  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      className={`popover ${className}`}
      style={position}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" && event.key !== "ArrowDown") return;
        const items = menuItems(event.currentTarget);
        const next = menuKeyTarget(items.indexOf(target), items.length, event.key);
        if (next === undefined) return;
        event.preventDefault();
        items[next].focus();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
