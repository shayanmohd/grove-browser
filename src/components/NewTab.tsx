import { useRef, useState, type FormEvent } from "react";
import {
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import type { Bookmark } from "../../shared/types";
import { newTabCopy } from "../copy";
import { Popover } from "./Popover";
import { SiteIcon } from "./ui";
import "./NewTab.css";

export function NewTab({
  bookmarks,
  onNavigate,
  onAddShortcut,
  onEditShortcut,
  onRemoveShortcut,
}: {
  bookmarks: Bookmark[];
  onNavigate: (url: string) => void;
  onAddShortcut: () => void;
  onEditShortcut: (bookmark: Bookmark) => void;
  onRemoveShortcut: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<Bookmark | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) onNavigate(query);
  }
  return (
    // test-branding, test-skill and review-session wait for these class names.
    <div className="new-tab home-page">
      <div className="new-tab-main home-intro">
        <form className="new-tab-search" onSubmit={search}>
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search the web"
            placeholder="Search the web or enter a URL"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <nav className="shortcut-tiles" aria-label={newTabCopy.shortcuts}>
          {bookmarks.slice(0, 8).map((bookmark) => (
            <button
              key={bookmark.id}
              type="button"
              className="shortcut-tile"
              title={bookmark.url}
              onClick={() => onNavigate(bookmark.url)}
              onContextMenu={(event) => {
                event.preventDefault();
                anchor.current = event.currentTarget;
                setMenu(bookmark);
              }}
            >
              <span className="shortcut-icon">
                <SiteIcon url={bookmark.url} size={22} />
              </span>
              <span className="shortcut-name">{bookmark.title}</span>
            </button>
          ))}
          <button type="button" className="shortcut-tile" onClick={onAddShortcut}>
            <span className="shortcut-icon">
              <Plus size={20} />
            </span>
            <span className="shortcut-name">{newTabCopy.add}</span>
          </button>
        </nav>
      </div>
      <Popover
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={anchor}
        label={menu ? newTabCopy.menu(menu.title) : ""}
      >
        {menu && (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                onEditShortcut(menu);
              }}
            >
              <PencilSimple size={16} />
              <span>{newTabCopy.edit}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                onRemoveShortcut(menu.id);
              }}
            >
              <Trash size={16} />
              <span>{newTabCopy.remove}</span>
            </button>
          </>
        )}
      </Popover>
    </div>
  );
}
