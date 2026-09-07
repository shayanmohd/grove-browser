import { useState } from "react";
import {
  X,
  Plus,
  ArrowUpRight,
  BookmarkSimple,
  ClockCounterClockwise,
  DownloadSimple,
  Trash,
  FolderOpen,
  Cpu,
  ShieldCheck,
  Hand,
  Play,
  Copy,
  Check,
  Terminal,
  Plug,
  ArrowRight,
} from "@phosphor-icons/react";
import type { BrowserAction, BrowserState } from "../../shared/types";
import { hostname } from "../../shared/url";
import { bridge, isDesktop } from "../lib/bridge";
import { EmptyState, IconButton, SiteIcon } from "./ui";

export type PanelName = "agents" | "bookmarks" | "history" | "downloads";
interface Props {
  panel: PanelName;
  state: BrowserState;
  onClose: () => void;
  dispatch: (action: BrowserAction) => void;
  onNavigate: (url: string) => void;
  onNewSpace: () => void;
  onAddBookmark: () => void;
  notify: (text: string) => void;
}
export function SidePanel({
  panel,
  state,
  onClose,
  dispatch,
  onNavigate,
  onNewSpace,
  onAddBookmark,
  notify,
}: Props) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const titles = {
    agents: "Agent studio",
    bookmarks: "Your bookmarks",
    history: "History",
    downloads: "Downloads",
  };
  const agentSpaces = state.spaces.filter((space) => space.kind === "agent");
  async function copyConnection() {
    try {
      const connection = await bridge.getAgentConnection();
      if (!connection) throw new Error("Enable the agent connection first.");
      await navigator.clipboard.writeText(JSON.stringify(connection, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify("Connection copied. Keep its token private.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not copy connection.",
      );
    }
  }
  function bytes(value: number) {
    return value < 1024 * 1024
      ? `${Math.round(value / 1024)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  return (
    <aside className="side-panel" aria-label={titles[panel]}>
      <div className="panel-heading">
        <h2>{titles[panel]}</h2>
        <IconButton label="Close panel" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="panel-scroll">
        {panel === "agents" ? (
          <>
            <div className="agent-intro">
              <span className="agent-intro-icon">
                <Cpu size={29} />
              </span>
              <h3>
                A second pair of hands.
                <br />A separate set of tabs.
              </h3>
              <p>Give your agent a space to work. Your browsing stays yours.</p>
            </div>
            <div className="connection-card">
              <div>
                <span
                  className={`connection-status ${state.automation.running ? "online" : ""}`}
                />
                <strong>
                  {state.automation.running
                    ? "Connection is on"
                    : "Connection is off"}
                </strong>
                <button
                  className={`toggle ${state.settings.automationEnabled ? "on" : ""}`}
                  role="switch"
                  aria-label="Enable agent connection"
                  aria-checked={state.settings.automationEnabled}
                  onClick={() =>
                    dispatch({
                      type: "settings:update",
                      settings: {
                        automationEnabled: !state.settings.automationEnabled,
                      },
                    })
                  }
                >
                  <span />
                </button>
              </div>
              <p>
                {isDesktop
                  ? "Connect a local agent through the Grove API."
                  : "Install the desktop app to connect an agent."}
              </p>
              {state.automation.running && (
                <button className="connection-copy" onClick={copyConnection}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                  {copied ? "Copied connection" : "Copy connection details"}
                </button>
              )}
            </div>
            <div className="panel-section-label">
              <h3>Agent spaces</h3>
              <button onClick={onNewSpace}>
                <Plus size={16} /> New
              </button>
            </div>
            {agentSpaces.length ? (
              <div className="agent-cards">
                {agentSpaces.map((space) => (
                  <div className="agent-space-card" key={space.id}>
                    <button
                      className="agent-space-open"
                      onClick={() =>
                        dispatch({ type: "space:activate", id: space.id })
                      }
                    >
                      <span className={`space-mini color-${space.color}`} />
                      <strong>{space.name}</strong>
                      <ArrowUpRight size={16} />
                    </button>
                    <p>
                      {
                        state.tabs.filter((tab) => tab.spaceId === space.id)
                          .length
                      }{" "}
                      tabs <span>/</span>{" "}
                      {space.owner === "human"
                        ? "You are in control"
                        : "Agent can access"}
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        dispatch({
                          type: "space:ownership",
                          id: space.id,
                          owner: space.owner === "human" ? "agent" : "human",
                        })
                      }
                    >
                      {space.owner === "human" ? (
                        <Play size={14} />
                      ) : (
                        <Hand size={14} />
                      )}
                      {space.owner === "human"
                        ? "Let agent continue"
                        : "Take control"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button className="new-agent-space" onClick={onNewSpace}>
                <Plus size={21} />
                <strong>Create an agent space</strong>
                <small>A clean session, just for the task.</small>
              </button>
            )}
            <div className="agent-privacy">
              <ShieldCheck size={19} />
              <p>
                Agent spaces have separate cookies and disappear when you quit.
                Take control at any time.
              </p>
            </div>
            <div className="panel-section-label">
              <h3>Activity</h3>
              <span>{state.activity.length}</span>
            </div>
            {state.activity.length ? (
              <div className="activity-list">
                {state.activity.slice(0, 25).map((item) => (
                  <div key={item.id}>
                    <span className={`activity-icon ${item.kind}`}>
                      {item.kind === "success" ? (
                        <Check size={13} />
                      ) : (
                        <Terminal size={13} />
                      )}
                    </span>
                    <p>
                      {item.message}
                      <time>
                        {new Date(item.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="activity-empty">
                <Plug size={20} />
                <p>Actions will appear here when an agent gets to work.</p>
              </div>
            )}
          </>
        ) : (
          <>
            {panel !== "downloads" && (
              <input
                className="panel-search"
                aria-label={`Search ${panel}`}
                placeholder={`Search ${panel}...`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
            {panel === "bookmarks" && (
              <>
                <button
                  className="secondary-button full-width"
                  onClick={onAddBookmark}
                >
                  <Plus size={16} /> Add a bookmark
                </button>
                <div className="library-list">
                  {state.bookmarks
                    .filter((item) =>
                      `${item.title} ${item.url}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((item) => (
                      <div className="library-row" key={item.id}>
                        <button onClick={() => onNavigate(item.url)}>
                          <SiteIcon url={item.url} size={20} />
                          <span>
                            <strong>{item.title}</strong>
                            <small>{hostname(item.url)}</small>
                          </span>
                        </button>
                        <IconButton
                          label={`Remove ${item.title}`}
                          onClick={() =>
                            dispatch({ type: "bookmark:remove", id: item.id })
                          }
                        >
                          <X size={15} />
                        </IconButton>
                      </div>
                    ))}
                </div>
                {!state.bookmarks.length && (
                  <EmptyState
                    icon={<BookmarkSimple size={30} />}
                    title="Keep a little inspiration"
                    text="Save a page with the bookmark button in the address bar."
                  />
                )}
              </>
            )}
            {panel === "history" && (
              <>
                {state.history.length > 0 && (
                  <div className="history-actions">
                    {confirmClear ? (
                      <>
                        <span>Clear all history?</span>
                        <button
                          onClick={() => {
                            dispatch({ type: "history:clear" });
                            setConfirmClear(false);
                          }}
                        >
                          Clear
                        </button>
                        <button onClick={() => setConfirmClear(false)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmClear(true)}>
                        <Trash size={14} /> Clear browsing history
                      </button>
                    )}
                  </div>
                )}
                <div className="library-list">
                  {state.history
                    .filter((item) =>
                      `${item.title} ${item.url}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .slice(0, 100)
                    .map((item) => (
                      <div className="library-row" key={item.id}>
                        <button onClick={() => onNavigate(item.url)}>
                          <SiteIcon url={item.url} size={20} />
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              {hostname(item.url)}{" "}
                              <span className="history-time">
                                {new Date(item.visitedAt).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric" },
                                )}
                              </span>
                            </small>
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    ))}
                </div>
                {!state.history.length && (
                  <EmptyState
                    icon={<ClockCounterClockwise size={30} />}
                    title="Start somewhere new"
                    text="The pages you visit will be waiting here when you need them."
                  />
                )}
              </>
            )}
            {panel === "downloads" && (
              <>
                {state.downloads.length ? (
                  <div className="downloads-list">
                    {state.downloads.map((item) => (
                      <div className="download-row" key={item.id}>
                        <span className="download-icon">
                          <DownloadSimple size={21} />
                        </span>
                        <div>
                          <strong>{item.filename}</strong>
                          <small>
                            {item.state} / {bytes(item.receivedBytes)}
                            {item.totalBytes
                              ? ` of ${bytes(item.totalBytes)}`
                              : ""}
                          </small>
                          {item.state === "progressing" && (
                            <progress
                              value={item.receivedBytes}
                              max={item.totalBytes || undefined}
                            />
                          )}
                        </div>
                        {item.state === "completed" && (
                          <IconButton
                            label={`Show ${item.filename} in folder`}
                            onClick={() =>
                              dispatch({ type: "download:show", id: item.id })
                            }
                          >
                            <FolderOpen size={19} />
                          </IconButton>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<DownloadSimple size={30} />}
                    title="Nothing downloaded yet"
                    text="Your downloads will show up here, with progress as they arrive."
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="panel-footnote">
        {panel === "agents" ? (
          <>
            <ShieldCheck size={14} /> Your browsing is always yours.
          </>
        ) : (
          "Stored locally on this device."
        )}
      </div>
    </aside>
  );
}
