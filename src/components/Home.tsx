import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react";
import type { BrowserState } from "../../shared/types";
import { hostname } from "../../shared/url";
import { SiteIcon } from "./ui";

interface Props {
  state: BrowserState;
  onNavigate: (url: string) => void;
  onCommand: () => void;
  onBookmark: () => void;
  onHistory: () => void;
}
export function Home({
  state,
  onNavigate,
  onCommand,
  onBookmark,
  onHistory,
}: Props) {
  const [query, setQuery] = useState("");
  const space = state.spaces.find((item) => item.id === state.activeSpaceId)!;
  const recent = state.history.slice(0, 3);
  function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) onNavigate(query);
  }
  const date = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  }).format(new Date());
  const modifier = state.platform === "darwin" ? "⌘" : "Ctrl";
  return (
    <div className="home-page">
      <div className="home-topline">
        <span>
          <span className={`space-mini color-${space.color}`} />
          {space.name}
        </span>
        <span>{date}</span>
      </div>
      <div className="home-main">
        <div className="home-intro">
          <h1>
            A little room
            <br />
            to think.
          </h1>
        </div>
        <form className="home-search" onSubmit={search}>
          <MagnifyingGlass size={20} />
          <input
            aria-label="Search the web"
            placeholder="Search the web or enter a URL"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="submit" className="search-submit" aria-label="Go">
              <ArrowRight size={19} />
            </button>
          ) : (
            <button
              type="button"
              className="search-shortcut"
              onClick={onCommand}
              aria-label="Open command palette"
              title={`Command palette (${modifier} K)`}
            >
              <kbd>{modifier} K</kbd>
            </button>
          )}
        </form>
        <section className="favorites-section" aria-label="Favorite websites">
          <div className="section-label">
            <h2>Shortcuts</h2>
            <button onClick={onBookmark}>
              <Plus size={14} /> Add shortcut
            </button>
          </div>
          {state.bookmarks.length ? (
            <div className="favorites">
              {state.bookmarks.slice(0, 6).map((bookmark) => (
                <button
                  className="favorite"
                  key={bookmark.id}
                  onClick={() => onNavigate(bookmark.url)}
                  title={bookmark.url}
                >
                  <span
                    className={`favorite-icon site-${hostname(bookmark.url).split(".")[0]}`}
                  >
                    <SiteIcon url={bookmark.url} size={23} />
                  </span>
                  <span>{bookmark.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="shortcuts-empty">Keep your favorite pages here.</p>
          )}
        </section>
        {recent.length > 0 && (
          <section className="recent-section" aria-label="Recent pages">
            <div className="section-label">
              <h2>Recently visited</h2>
              <button onClick={onHistory} aria-label="View all history">
                View all <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="recent-list">
              {recent.map((entry) => (
                <button key={entry.id} onClick={() => onNavigate(entry.url)}>
                  <span className="recent-icon">
                    <SiteIcon url={entry.url} size={17} />
                  </span>
                  <span>
                    <strong>{entry.title}</strong>
                    <small>{hostname(entry.url)}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="landscape">
        <img
          src="./forest.jpg"
          alt="A mountain lake surrounded by a quiet green forest"
        />
      </div>
    </div>
  );
}
