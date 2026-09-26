import { useState } from "react";
import {
  ArrowRight,
  BookmarkSimple,
  ClockCounterClockwise,
  DownloadSimple,
  FolderOpen,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import type { BrowserAction, BrowserState } from "../../shared/types";
import { hostname } from "../../shared/url";
import { EmptyState, IconButton, Modal, SiteIcon } from "./ui";

export type LibraryKind = "bookmarks" | "history" | "downloads";

const titles: Record<LibraryKind, string> = {
  bookmarks: "Your bookmarks",
  history: "History",
  downloads: "Downloads",
};

interface BodyProps {
  kind: LibraryKind;
  state: BrowserState;
  dispatch: (action: BrowserAction) => void;
  onNavigate: (url: string) => void;
  onAddBookmark: () => void;
}

export function LibraryDialog({
  kind,
  onClose,
  ...props
}: Omit<BodyProps, "kind"> & {
  kind: LibraryKind | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!kind}
      onClose={onClose}
      title={titles[kind ?? "bookmarks"]}
      className="library-dialog"
    >
      {kind && <LibraryBody key={kind} kind={kind} {...props} />}
      <p className="library-footnote">Stored locally on this device.</p>
    </Modal>
  );
}

function bytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.round(value / 1024)} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function LibraryBody({
  kind,
  state,
  dispatch,
  onNavigate,
  onAddBookmark,
}: BodyProps) {
  const [query, setQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const matches = (item: { title: string; url: string }) =>
    `${item.title} ${item.url}`.toLowerCase().includes(query.toLowerCase());
  return (
    <>
      {kind !== "downloads" && (
        <input
          className="panel-search"
          aria-label={`Search ${kind}`}
          placeholder={`Search ${kind}...`}
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {kind === "bookmarks" && (
        <>
          <button
            className="secondary-button full-width"
            onClick={onAddBookmark}
          >
            <Plus size={16} /> Add a bookmark
          </button>
          <div className="library-list">
            {state.bookmarks.filter(matches).map((item) => (
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
      {kind === "history" && (
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
                  <button onClick={() => setConfirmClear(false)}>Cancel</button>
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
              .filter(matches)
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
      {kind === "downloads" &&
        (state.downloads.length ? (
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
                    {item.totalBytes ? ` of ${bytes(item.totalBytes)}` : ""}
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
        ))}
    </>
  );
}
