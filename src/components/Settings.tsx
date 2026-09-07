import {
  Monitor,
  Moon,
  Sun,
  ArrowUpRight,
  TreeEvergreen,
} from "@phosphor-icons/react";
import type { BrowserAction, BrowserState, Theme } from "../../shared/types";
import { Modal } from "./ui";

export function Settings({
  open,
  onClose,
  state,
  dispatch,
}: {
  open: boolean;
  onClose: () => void;
  state: BrowserState;
  dispatch: (action: BrowserAction) => void;
}) {
  const update = (
    settings: Parameters<typeof dispatch>[0] & { type: "settings:update" },
  ) => dispatch(settings);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Make Grove yours"
      description="Small preferences for a space that feels like you."
      className="settings-modal"
    >
      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="theme-options">
          {(
            [
              { value: "light", title: "Light", icon: <Sun size={18} /> },
              { value: "dark", title: "Dark", icon: <Moon size={18} /> },
              { value: "system", title: "System", icon: <Monitor size={18} /> },
            ] as const
          ).map((theme) => (
            <button
              key={theme.value}
              className={`theme-option ${theme.value} ${state.settings.theme === theme.value ? "selected" : ""}`}
              onClick={() =>
                update({
                  type: "settings:update",
                  settings: { theme: theme.value as Theme },
                })
              }
              aria-pressed={state.settings.theme === theme.value}
            >
              <span className="theme-preview">
                <i />
                <span>
                  <b />
                  <b />
                  <b />
                </span>
              </span>
              <span>
                {theme.icon}
                {theme.title}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h3>Browsing</h3>
        <div className="setting-row">
          <div>
            <strong>Search engine</strong>
            <p>Where your questions take you.</p>
          </div>
          <select
            aria-label="Default search engine"
            value={state.settings.searchEngine}
            onChange={(event) =>
              update({
                type: "settings:update",
                settings: {
                  searchEngine: event.target
                    .value as BrowserState["settings"]["searchEngine"],
                },
              })
            }
          >
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="google">Google</option>
            <option value="bing">Bing</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <strong>Pick up where you left off</strong>
            <p>Restore personal tabs when Grove opens.</p>
          </div>
          <button
            role="switch"
            aria-label="Restore previous session"
            aria-checked={state.settings.restoreSession}
            className={`toggle ${state.settings.restoreSession ? "on" : ""}`}
            onClick={() =>
              update({
                type: "settings:update",
                settings: { restoreSession: !state.settings.restoreSession },
              })
            }
          >
            <span />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Bookmarks bar</strong>
            <p>Your favorite pages, always in reach.</p>
          </div>
          <button
            role="switch"
            aria-label="Show bookmarks bar"
            aria-checked={state.settings.showBookmarksBar}
            className={`toggle ${state.settings.showBookmarksBar ? "on" : ""}`}
            onClick={() =>
              update({
                type: "settings:update",
                settings: {
                  showBookmarksBar: !state.settings.showBookmarksBar,
                },
              })
            }
          >
            <span />
          </button>
        </div>
      </section>
      <div className="settings-about">
        <span className="brand-mark">
          <TreeEvergreen size={23} weight="fill" />
        </span>
        <div>
          <strong>
            Grove <span>{state.version}</span>
          </strong>
          <p>Built for curiosity. Made to be yours.</p>
        </div>
        <span className="platform-label">
          {state.platform === "web"
            ? "Web preview"
            : state.platform === "darwin"
              ? "macOS"
              : state.platform === "win32"
                ? "Windows"
                : "Linux"}
          <ArrowUpRight size={14} />
        </span>
      </div>
    </Modal>
  );
}
