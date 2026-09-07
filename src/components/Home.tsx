import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  MagnifyingGlass,
  Plus,
  ClockCounterClockwise,
  Command,
  Cpu,
  Leaf,
  Compass,
  Stack,
} from "@phosphor-icons/react";
import type { BrowserState } from "../../shared/types";
import { hostname } from "../../shared/url";
import { SiteIcon } from "./ui";

interface Props {
  state: BrowserState;
  onNavigate: (url: string) => void;
  onCommand: () => void;
  onBookmark: () => void;
  onAgents: () => void;
  onHistory: () => void;
  onSpace: () => void;
}
export function Home({
  state,
  onNavigate,
  onCommand,
  onBookmark,
  onAgents,
  onHistory,
  onSpace,
}: Props) {
  const [query, setQuery] = useState("");
  const space = state.spaces.find((item) => item.id === state.activeSpaceId)!;
  const recent = state.history.slice(0, 3);
  function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) onNavigate(query);
  }
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const modifier = state.platform === "darwin" ? "⌘" : "Ctrl";
  return (
    <div className="home-page">
      <div className="home-topline">
        <span>
          <span className={`space-mini color-${space.color}`} />
          {space.name} space
        </span>
        <span>{date}</span>
      </div>
      <div className="home-intro">
        <div className="eyebrow">
          <Leaf size={15} /> A fresh perspective
        </div>
        <h1>
          A little room
          <br />
          to think.
        </h1>
        <p>
          Your ideas, your tabs, your own pace.
          <br className="small-break" /> Make yourself at home.
        </p>
      </div>
      <form className="home-search" onSubmit={search}>
        <MagnifyingGlass size={21} />
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
          <button type="button" className="search-shortcut" onClick={onCommand}>
            <kbd>{modifier}</kbd>
            <kbd>K</kbd>
          </button>
        )}
      </form>
      <section className="favorites-section" aria-label="Favorite websites">
        <div className="section-label">
          <h2>Your everyday</h2>
          <button onClick={onBookmark}>
            Add shortcut <Plus size={14} />
          </button>
        </div>
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
                <SiteIcon url={bookmark.url} size={25} />
              </span>
              <span>{bookmark.title}</span>
            </button>
          ))}
          <button className="favorite favorite-add" onClick={onBookmark}>
            <span className="favorite-icon">
              <Plus size={23} />
            </span>
            <span>Add new</span>
          </button>
        </div>
      </section>
      <section className="home-bottom">
        <div className="recent-section">
          <div className="section-label">
            <h2>Pick up where you left off</h2>
            <button onClick={onHistory} aria-label="View all history">
              <ArrowUpRight size={16} />
            </button>
          </div>
          {recent.length ? (
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
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="home-history-empty">
              <ClockCounterClockwise size={22} />
              <div>
                <strong>A clean slate looks good on you.</strong>
                <span>Your recent pages will appear here.</span>
              </div>
            </div>
          )}
        </div>
        <button className="agent-feature" onClick={onAgents}>
          <span className="feature-icon">
            <Cpu size={22} />
          </span>
          <span>
            <strong>A space for your agent.</strong>
            <small>Let it explore. Stay in control.</small>
          </span>
          <ArrowUpRight size={19} />
        </button>
      </section>
      <div className="home-footer">
        <span>
          <span className="leaf-mark">
            <Leaf size={14} />
          </span>{" "}
          A calmer corner of the internet.
        </span>
        <button onClick={onSpace}>
          <Stack size={15} /> Organize your spaces
        </button>
      </div>
      <div className="landscape">
        <img
          src="./forest.jpg"
          alt="A mountain lake surrounded by a quiet green forest"
        />
        <div className="landscape-shade" />
        <div className="landscape-copy">
          <Compass size={24} />
          <span>
            Less noise.
            <br />
            More possibility.
          </span>
          <p>Find your own way.</p>
        </div>
        <span className="landscape-caption">
          Take a breath. Then a new direction.
        </span>
      </div>
    </div>
  );
}
