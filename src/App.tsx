import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowClockwise,
  X,
  Plus,
  Minus,
  Square,
  MagnifyingGlass,
  LockSimple,
  GlobeHemisphereWest,
  BookmarkSimple,
  SidebarSimple,
  Columns,
  Cpu,
  DotsThree,
  CaretDown,
  CaretUp,
  ArrowSquareOut,
  ArrowUpRight,
  PushPin,
  Copy,
  Trash,
  Camera,
  Code,
  WarningCircle,
  Hand,
  Check,
  Stack,
  Keyboard,
  TreeEvergreen,
} from "@phosphor-icons/react";
import type { BrowserAction, BrowserState, SpaceColor } from "../shared/types";
import { HOME_URL, initialState } from "../shared/state";
import { hostname } from "../shared/url";
import { bridge, isDesktop } from "./lib/bridge";
import { Brand, IconButton, Modal, SiteIcon } from "./components/ui";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./components/Home";
import { CommandPalette } from "./components/CommandPalette";
import { SidePanel, type PanelName } from "./components/Panels";
import { Settings } from "./components/Settings";

type ModalName =
  | "command"
  | "settings"
  | "space"
  | "bookmark"
  | "split"
  | "tab-menu"
  | "manage-space"
  | "menu"
  | null;
export default function App() {
  const [state, setState] = useState<BrowserState>(() => initialState());
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [panel, setPanel] = useState<PanelName | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [address, setAddress] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [toast, setToast] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [spaceKind, setSpaceKind] = useState<"personal" | "agent">("personal");
  const [spaceColor, setSpaceColor] = useState<SpaceColor>("green");
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [bookmarkUrl, setBookmarkUrl] = useState("");
  const [selectedTab, setSelectedTab] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const active =
    state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0];
  const activeSpace =
    state.spaces.find((space) => space.id === state.activeSpaceId) ||
    state.spaces[0];
  const splitTab = state.tabs.find((tab) => tab.id === state.splitTabId);
  const isHome = !active || active.url === HOME_URL;
  const ownedByAgent =
    activeSpace.kind === "agent" && activeSpace.owner === "agent";
  const mac = state.platform === "darwin";
  const modifier = mac ? "⌘" : "Ctrl";
  const bookmarked = state.bookmarks.find(
    (bookmark) => bookmark.url === active?.url,
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);
  const dispatch = useCallback(
    async (action: BrowserAction) => {
      try {
        setState(await bridge.dispatch(action));
        return true;
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        );
        return false;
      }
    },
    [notify],
  );
  useEffect(() => {
    let alive = true;
    const unsubscribe = bridge.subscribe((next) => {
      if (alive) setState(next);
    });
    bridge
      .getState()
      .then((next) => {
        if (alive) {
          setState(next);
          setReady(true);
        }
      })
      .catch(() => {
        notify("Grove could not load the session. Please restart the app.");
        setReady(true);
      });
    return () => {
      alive = false;
      unsubscribe();
      clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function syncTheme() {
      document.documentElement.dataset.theme =
        state.settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : state.settings.theme;
    }
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [state.settings.theme]);
  useEffect(() => {
    setAddress(isHome ? "" : active?.url || "");
  }, [active?.url, active?.id, isHome]);
  useEffect(() => {
    setFormError("");
    setConfirmDelete(false);
  }, [modal]);
  useEffect(() => {
    setFindOpen(false);
    setFindText("");
  }, [active?.id]);
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    function sendBounds() {
      const rect = element!.getBoundingClientRect();
      bridge.setContentBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        hidden: !!modal || !ready,
      });
    }
    sendBounds();
    const observer = new ResizeObserver(sendBounds);
    observer.observe(element);
    window.addEventListener("resize", sendBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sendBounds);
    };
  }, [
    collapsed,
    panel,
    modal,
    state.settings.showBookmarksBar,
    ready,
    findOpen,
    ownedByAgent,
  ]);

  const navigate = useCallback(
    (url: string) => {
      if (active) void dispatch({ type: "tab:navigate", id: active.id, url });
      setAddressFocused(false);
      addressRef.current?.blur();
    },
    [active, dispatch],
  );
  const openSpace = useCallback((kind: "personal" | "agent" = "personal") => {
    setSpaceName("");
    setSpaceKind(kind);
    setSpaceColor(kind === "agent" ? "purple" : "green");
    setModal("space");
  }, []);
  const openBookmark = useCallback(() => {
    setBookmarkTitle(isHome ? "" : active.title);
    setBookmarkUrl(isHome ? "" : active.url);
    setModal("bookmark");
  }, [active, isHome]);
  const showPanel = useCallback(
    (name: string) => {
      if (name === "settings" || name === "manage-space") {
        if (name === "manage-space") setSpaceName(activeSpace.name);
        setModal(name);
        return;
      }
      setPanel((current) => (current === name ? null : (name as PanelName)));
    },
    [activeSpace.name],
  );
  const action = useCallback(
    (name: string) => {
      switch (name) {
        case "new-tab":
          void dispatch({ type: "tab:create" });
          break;
        case "close-tab":
          if (active) void dispatch({ type: "tab:close", id: active.id });
          break;
        case "reopen-tab":
          void dispatch({ type: "tab:reopen" });
          break;
        case "command":
          setModal("command");
          break;
        case "address":
          addressRef.current?.focus();
          addressRef.current?.select();
          break;
        case "find":
          if (!isHome) setFindOpen(true);
          break;
        case "bookmark":
          if (!isHome) openBookmark();
          break;
        case "reload":
          if (active) void dispatch({ type: "tab:reload", id: active.id });
          break;
        case "sidebar":
          setCollapsed((value) => !value);
          break;
        case "space":
          openSpace();
          break;
        case "split":
          if (state.splitTabId) void dispatch({ type: "tab:split", id: null });
          else setModal("split");
          break;
        case "settings":
          setModal("settings");
          break;
        case "agents":
        case "bookmarks":
        case "history":
        case "downloads":
          showPanel(name);
          break;
        case "next-tab":
        case "previous-tab": {
          const tabs = state.tabs.filter(
            (tab) => tab.spaceId === state.activeSpaceId,
          );
          const index = tabs.findIndex((tab) => tab.id === active?.id);
          const next =
            tabs[
              (index + (name === "next-tab" ? 1 : -1) + tabs.length) %
                tabs.length
            ];
          if (next) void dispatch({ type: "tab:activate", id: next.id });
          break;
        }
      }
    },
    [dispatch, active, isHome, openSpace, openBookmark, state, showPanel],
  );
  useEffect(() => bridge.onShortcut(action), [action]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (
        mod &&
        ["k", "l", "t", "w", "f", "r", "b", ",", "d"].includes(
          event.key.toLowerCase(),
        )
      ) {
        event.preventDefault();
        const key = event.key.toLowerCase();
        if (key === "d") {
          if (!isHome) openBookmark();
          return;
        }
        const mapping: Record<string, string> = {
          k: "command",
          l: "address",
          t: event.shiftKey ? "reopen-tab" : "new-tab",
          w: "close-tab",
          f: "find",
          r: "reload",
          b: "sidebar",
          ",": "settings",
        };
        action(mapping[key]);
      }
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        action(event.shiftKey ? "previous-tab" : "next-tab");
      }
      if (event.key === "Escape") {
        setFindOpen(false);
        setAddressFocused(false);
        addressRef.current?.blur();
        void dispatch({ type: "page:stop-find" });
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [action, dispatch, isHome, openBookmark]);
  function closeModal() {
    setModal(null);
  }
  const menuTab = state.tabs.find((tab) => tab.id === selectedTab);

  return (
    <div
      className={`browser-app ${collapsed ? "sidebar-is-collapsed" : ""} platform-${state.platform}`}
    >
      <Sidebar
        state={state}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        dispatch={dispatch}
        onCommand={() => setModal("command")}
        onPanel={showPanel}
        onSpace={() => openSpace()}
        onTabMenu={(id) => {
          setSelectedTab(id);
          setModal("tab-menu");
        }}
      />
      <main className="browser-main">
        <header className="toolbar drag-region">
          {collapsed && (
            <IconButton
              label="Expand sidebar"
              onClick={() => setCollapsed(false)}
            >
              <SidebarSimple size={19} />
            </IconButton>
          )}
          <div className="navigation-controls">
            <IconButton
              label={`Go back (${mac ? "⌘ [" : "Alt+Left"})`}
              disabled={!active?.canGoBack || ownedByAgent}
              onClick={() => dispatch({ type: "tab:back", id: active.id })}
            >
              <ArrowLeft size={18} />
            </IconButton>
            <IconButton
              label="Go forward"
              disabled={!active?.canGoForward || ownedByAgent}
              onClick={() => dispatch({ type: "tab:forward", id: active.id })}
            >
              <ArrowRight size={18} />
            </IconButton>
            <IconButton
              label={active?.loading ? "Stop loading" : "Reload page"}
              disabled={isHome || ownedByAgent}
              onClick={() =>
                dispatch({
                  type: active.loading ? "tab:stop" : "tab:reload",
                  id: active.id,
                })
              }
            >
              {active?.loading ? <X size={17} /> : <ArrowClockwise size={18} />}
            </IconButton>
          </div>
          <form
            className={`address-bar ${addressFocused ? "focused" : ""}`}
            onSubmit={(event) => {
              event.preventDefault();
              navigate(address);
            }}
          >
            <span
              className="address-icon"
              title={
                isHome
                  ? "Grove new tab"
                  : active.url.startsWith("https:")
                    ? "Connection uses HTTPS"
                    : "Connection is not encrypted"
              }
            >
              {isHome ? (
                <TreeEvergreen size={16} />
              ) : active.url.startsWith("https:") ? (
                <LockSimple size={15} />
              ) : (
                <GlobeHemisphereWest size={16} />
              )}
            </span>
            <input
              ref={addressRef}
              aria-label="Address bar"
              value={address}
              disabled={ownedByAgent}
              placeholder="Search or enter a URL"
              spellCheck={false}
              onFocus={(event) => {
                setAddressFocused(true);
                event.target.select();
              }}
              onBlur={() => setAddressFocused(false)}
              onChange={(event) => setAddress(event.target.value)}
            />
            <IconButton
              label={bookmarked ? "Remove bookmark" : "Bookmark this page"}
              disabled={isHome}
              className={bookmarked ? "is-bookmarked" : ""}
              onClick={() =>
                bookmarked
                  ? dispatch({ type: "bookmark:remove", id: bookmarked.id })
                  : dispatch({
                      type: "bookmark:add",
                      title: active.title,
                      url: active.url,
                    })
              }
            >
              <BookmarkSimple
                size={17}
                weight={bookmarked ? "fill" : "regular"}
              />
            </IconButton>
          </form>
          <div className="toolbar-actions">
            <IconButton
              label={state.splitTabId ? "Close split view" : "Open split view"}
              className={state.splitTabId ? "is-active" : ""}
              onClick={() => action("split")}
            >
              <Columns size={19} />
            </IconButton>
            <IconButton
              label="Open agent studio"
              className={panel === "agents" ? "is-active" : ""}
              onClick={() => showPanel("agents")}
            >
              <Cpu size={19} />
            </IconButton>
            <span className="toolbar-divider" />
            <IconButton label="Browser menu" onClick={() => setModal("menu")}>
              <DotsThree size={23} weight="bold" />
            </IconButton>
          </div>
          {isDesktop && !mac && (
            <div className="window-controls">
              <IconButton
                label="Minimize window"
                onClick={() => bridge.windowControl("minimize")}
              >
                <Minus size={15} />
              </IconButton>
              <IconButton
                label="Maximize window"
                onClick={() => bridge.windowControl("maximize")}
              >
                <Square size={12} />
              </IconButton>
              <IconButton
                label="Close window"
                className="window-close"
                onClick={() => bridge.windowControl("close")}
              >
                <X size={17} />
              </IconButton>
            </div>
          )}
        </header>
        {state.settings.showBookmarksBar && (
          <nav className="bookmarks-bar" aria-label="Bookmarks bar">
            {state.bookmarks.map((bookmark) => (
              <button key={bookmark.id} onClick={() => navigate(bookmark.url)}>
                <SiteIcon url={bookmark.url} size={14} />
                {bookmark.title}
              </button>
            ))}
            <IconButton label="Add bookmark" onClick={openBookmark}>
              <Plus size={14} />
            </IconButton>
          </nav>
        )}
        {ownedByAgent && (
          <div className="ownership-bar">
            <Cpu size={16} />
            <span>An agent has control of this space.</span>
            <button
              onClick={() =>
                dispatch({
                  type: "space:ownership",
                  id: activeSpace.id,
                  owner: "human",
                })
              }
            >
              <Hand size={14} /> Take control
            </button>
          </div>
        )}
        {findOpen && (
          <form
            className="find-bar"
            onSubmit={(event) => {
              event.preventDefault();
              void dispatch({
                type: "page:find",
                text: findText,
                forward: true,
              });
            }}
          >
            <MagnifyingGlass size={16} />
            <input
              autoFocus
              aria-label="Find in page"
              value={findText}
              onChange={(event) => {
                setFindText(event.target.value);
                if (event.target.value)
                  void dispatch({
                    type: "page:find",
                    text: event.target.value,
                  });
                else void dispatch({ type: "page:stop-find" });
              }}
              placeholder="Find in page"
            />
            <IconButton
              label="Previous match"
              onClick={() =>
                dispatch({ type: "page:find", text: findText, forward: false })
              }
            >
              <CaretUp size={16} />
            </IconButton>
            <IconButton
              label="Next match"
              onClick={() =>
                dispatch({ type: "page:find", text: findText, forward: true })
              }
            >
              <CaretDown size={16} />
            </IconButton>
            <IconButton
              label="Close find"
              onClick={() => {
                setFindOpen(false);
                void dispatch({ type: "page:stop-find" });
              }}
            >
              <X size={16} />
            </IconButton>
          </form>
        )}
        <div className={`content-layout ${panel ? "with-panel" : ""}`}>
          <div className="page-viewport" ref={contentRef}>
            {isHome ? (
              <Home
                state={state}
                onNavigate={navigate}
                onCommand={() => setModal("command")}
                onBookmark={openBookmark}
                onAgents={() => setPanel("agents")}
                onHistory={() => setPanel("history")}
                onSpace={() => openSpace()}
              />
            ) : (
              <div className={`web-page ${splitTab ? "split-preview" : ""}`}>
                {!isDesktop ? (
                  <>
                    <PreviewPage
                      url={active.url}
                      onHome={() => navigate(HOME_URL)}
                    />
                    {splitTab && (
                      <PreviewPage
                        url={splitTab.url}
                        onHome={() => dispatch({ type: "tab:split", id: null })}
                      />
                    )}
                  </>
                ) : active.error ? (
                  <div className="page-error">
                    <WarningCircle size={39} />
                    <h2>This page took a wrong turn.</h2>
                    <p>{active.error}</p>
                    <button
                      className="primary-button"
                      onClick={() =>
                        dispatch({ type: "tab:reload", id: active.id })
                      }
                    >
                      Try again <ArrowClockwise size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="page-loading" aria-live="polite">
                    {active.loading && (
                      <>
                        <div />
                        <p>Finding your way to {hostname(active.url)}...</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {panel && (
            <SidePanel
              key={panel}
              panel={panel}
              state={state}
              onClose={() => setPanel(null)}
              dispatch={dispatch}
              onNavigate={navigate}
              onNewSpace={() => openSpace("agent")}
              onAddBookmark={openBookmark}
              notify={notify}
            />
          )}
        </div>
        <footer className="browser-status">
          <span>
            <TreeEvergreen size={12} />
            {isDesktop
              ? activeSpace.kind === "agent"
                ? "Ephemeral agent session"
                : "Your space. Your pace."
              : "Interactive web preview"}
          </span>
          <span>
            {state.tabs.length} tabs across {state.spaces.length} spaces
            <span className="status-separator" />
            {isDesktop
              ? state.platform === "darwin"
                ? "macOS"
                : state.platform === "win32"
                  ? "Windows"
                  : "Linux"
              : "Desktop app for macOS, Windows & Linux"}
          </span>
        </footer>
      </main>
      <CommandPalette
        open={modal === "command"}
        onClose={closeModal}
        state={state}
        onNavigate={navigate}
        onTab={(id) => dispatch({ type: "tab:activate", id })}
        onAction={action}
      />
      <Settings
        open={modal === "settings"}
        onClose={closeModal}
        state={state}
        dispatch={dispatch}
      />
      <Modal
        open={modal === "space"}
        onClose={closeModal}
        title={
          spaceKind === "agent"
            ? "A space for your agent"
            : "Make a little space"
        }
        description={
          spaceKind === "agent"
            ? "A separate, temporary session. You decide when an agent can access it."
            : "Group your tabs and keep cookies separate for each part of your day."
        }
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!spaceName.trim()) {
              setFormError("Give your space a name.");
              return;
            }
            if (
              await dispatch({
                type: "space:create",
                name: spaceName,
                color: spaceColor,
                kind: spaceKind,
              })
            ) {
              closeModal();
              if (spaceKind === "agent") setPanel("agents");
            }
          }}
        >
          <label className="field-label" htmlFor="space-name">
            Space name
          </label>
          <input
            id="space-name"
            className="text-input"
            autoFocus
            maxLength={40}
            placeholder={
              spaceKind === "agent"
                ? "e.g. Research assistant"
                : "e.g. Weekend project"
            }
            value={spaceName}
            onChange={(event) => setSpaceName(event.target.value)}
          />
          <label className="field-label">A color of its own</label>
          <div className="color-options">
            {(["green", "blue", "orange", "purple"] as const).map((color) => (
              <button
                type="button"
                key={color}
                aria-label={`${color} space color`}
                aria-pressed={spaceColor === color}
                className={`color-option color-${color} ${spaceColor === color ? "selected" : ""}`}
                onClick={() => setSpaceColor(color)}
              >
                {spaceColor === color && <Check size={17} />}
              </button>
            ))}
          </div>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Create space <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={modal === "bookmark"}
        onClose={closeModal}
        title="Keep something good"
        description="Add a favorite to your new tab page and bookmarks."
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!bookmarkUrl.trim()) {
              setFormError("Enter a website address.");
              return;
            }
            if (
              await dispatch({
                type: "bookmark:add",
                title: bookmarkTitle,
                url: bookmarkUrl,
              })
            ) {
              closeModal();
              notify("Bookmark saved.");
            }
          }}
        >
          <label className="field-label" htmlFor="bookmark-name">
            Name
          </label>
          <input
            id="bookmark-name"
            autoFocus
            className="text-input"
            placeholder="A name to remember"
            value={bookmarkTitle}
            onChange={(event) => setBookmarkTitle(event.target.value)}
          />
          <label className="field-label" htmlFor="bookmark-url">
            Website address
          </label>
          <input
            id="bookmark-url"
            className="text-input"
            placeholder="https://example.com"
            value={bookmarkUrl}
            onChange={(event) => setBookmarkUrl(event.target.value)}
          />
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Save bookmark <BookmarkSimple size={16} />
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={modal === "split"}
        onClose={closeModal}
        title="A wider perspective"
        description="Choose another page in this space to view alongside the current tab."
      >
        <div className="split-options">
          {state.tabs
            .filter(
              (tab) =>
                tab.spaceId === state.activeSpaceId &&
                tab.id !== active?.id &&
                tab.url !== HOME_URL,
            )
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  void dispatch({ type: "tab:split", id: tab.id });
                  closeModal();
                }}
              >
                <SiteIcon url={tab.url} />
                <span>
                  <strong>{tab.title}</strong>
                  <small>{hostname(tab.url)}</small>
                </span>
                <Columns size={18} />
              </button>
            ))}
        </div>
        {isHome ? (
          <p className="info-note">
            Open a website in this tab first, then choose a second page for
            split view.
          </p>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const input = new FormData(event.currentTarget).get(
                "split-url",
              ) as string;
              if (!input.trim()) return;
              try {
                const previousIds = new Set(state.tabs.map((tab) => tab.id));
                const next = await bridge.dispatch({
                  type: "tab:create",
                  url: input,
                  background: true,
                });
                const created = next.tabs.find(
                  (tab) => !previousIds.has(tab.id),
                );
                if (created)
                  await dispatch({ type: "tab:split", id: created.id });
                closeModal();
              } catch (error) {
                notify(
                  error instanceof Error
                    ? error.message
                    : "Could not open split view.",
                );
              }
            }}
          >
            <label className="field-label" htmlFor="split-url">
              Or open a new page alongside
            </label>
            <div className="inline-form">
              <input
                id="split-url"
                className="text-input"
                name="split-url"
                placeholder="Enter a URL or search"
              />
              <button className="primary-button" type="submit">
                <Plus size={18} /> Open
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={modal === "tab-menu"}
        onClose={closeModal}
        title={menuTab?.title || "Tab options"}
        className="small-modal"
      >
        <div className="action-menu">
          {menuTab && (
            <>
              <button
                onClick={() => {
                  void dispatch({ type: "tab:pin", id: menuTab.id });
                  closeModal();
                }}
              >
                <PushPin size={18} />
                {menuTab.pinned ? "Unpin tab" : "Pin tab"}
              </button>
              <button
                onClick={() => {
                  void dispatch({ type: "tab:duplicate", id: menuTab.id });
                  closeModal();
                }}
              >
                <Copy size={18} />
                Duplicate tab
              </button>
              <button
                onClick={() => {
                  void dispatch({ type: "tab:close", id: menuTab.id });
                  closeModal();
                }}
              >
                <X size={18} />
                Close tab
              </button>
            </>
          )}
        </div>
      </Modal>
      <Modal
        open={modal === "manage-space"}
        onClose={closeModal}
        title="A place for everything"
        description="Rename this space or remove it along with its tabs."
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              spaceName.trim() &&
              (await dispatch({
                type: "space:rename",
                id: activeSpace.id,
                name: spaceName,
              }))
            )
              closeModal();
          }}
        >
          <label className="field-label" htmlFor="rename-space">
            Space name
          </label>
          <input
            className="text-input"
            id="rename-space"
            value={spaceName}
            onChange={(event) => setSpaceName(event.target.value)}
            maxLength={40}
          />
          <div className="modal-actions">
            <button
              type="button"
              className="danger-button"
              disabled={
                state.spaces.filter((space) => space.kind === "personal")
                  .length === 1 && activeSpace.kind === "personal"
              }
              onClick={async () => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                if (
                  await dispatch({ type: "space:delete", id: activeSpace.id })
                )
                  closeModal();
              }}
            >
              <Trash size={16} />
              {confirmDelete ? "Confirm delete" : "Delete space"}
            </button>
            <button type="submit" className="primary-button">
              Save changes
            </button>
          </div>
          {confirmDelete && (
            <p className="form-error">
              This closes every tab in this space and removes its session.
            </p>
          )}
        </form>
      </Modal>
      <Modal
        open={modal === "menu"}
        onClose={closeModal}
        title="A few useful things"
        className="small-modal"
      >
        <div className="action-menu">
          <button
            onClick={() => {
              closeModal();
              action("new-tab");
            }}
          >
            <Plus size={18} />
            New tab<kbd>{modifier} T</kbd>
          </button>
          <button
            onClick={() => {
              closeModal();
              action("reopen-tab");
            }}
          >
            <ArrowClockwise size={18} />
            Reopen closed tab<kbd>⇧ {modifier} T</kbd>
          </button>
          <button
            onClick={() => {
              closeModal();
              action("command");
            }}
          >
            <Keyboard size={18} />
            Command palette<kbd>{modifier} K</kbd>
          </button>
          <hr />
          <button
            disabled={isHome}
            onClick={() => {
              closeModal();
              action("find");
            }}
          >
            <MagnifyingGlass size={18} />
            Find in page<kbd>{modifier} F</kbd>
          </button>
          <button
            disabled={isHome}
            onClick={() => {
              closeModal();
              void dispatch({ type: "page:screenshot" });
            }}
          >
            <Camera size={18} />
            Save page screenshot
          </button>
          <button
            disabled={isHome}
            onClick={() => {
              closeModal();
              void dispatch({ type: "page:devtools" });
            }}
          >
            <Code size={18} />
            Developer tools
          </button>
          <div className="zoom-row">
            <span>Page zoom</span>
            <IconButton
              label="Zoom out"
              onClick={() => dispatch({ type: "page:zoom", direction: "out" })}
            >
              <Minus size={15} />
            </IconButton>
            <button
              onClick={() =>
                dispatch({ type: "page:zoom", direction: "reset" })
              }
            >
              Reset
            </button>
            <IconButton
              label="Zoom in"
              onClick={() => dispatch({ type: "page:zoom", direction: "in" })}
            >
              <Plus size={15} />
            </IconButton>
          </div>
          <hr />
          <button onClick={() => setModal("settings")}>
            <Stack size={18} />
            Settings<kbd>{modifier} ,</kbd>
          </button>
        </div>
      </Modal>
      {toast && (
        <div className="toast" role="status">
          <TreeEvergreen size={17} />
          <span>{toast}</span>
          <IconButton label="Dismiss notification" onClick={() => setToast("")}>
            <X size={14} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
function PreviewPage({ url, onHome }: { url: string; onHome: () => void }) {
  return (
    <div className="preview-page">
      <div className="preview-browser-symbol">
        <GlobeHemisphereWest size={34} />
        <span>
          <ArrowUpRight size={16} />
        </span>
      </div>
      <span className="eyebrow">You are exploring the web preview</span>
      <h2>
        The whole web.
        <br />
        In the desktop app.
      </h2>
      <p>
        Grove opens real websites in its own browser engine on macOS, Windows,
        and Linux.
      </p>
      <div className="preview-url">
        <LockSimple size={15} />
        <span>{url}</span>
      </div>
      <a className="primary-button" href={url} target="_blank" rel="noreferrer">
        Open in your browser <ArrowSquareOut size={16} />
      </a>
      <button className="text-button" onClick={onHome}>
        Back to your space <ArrowLeft size={15} />
      </button>
      <p className="preview-note">
        Tabs, spaces, bookmarks, and settings work in this preview. Desktop
        browsing uses Electron and Chromium.
      </p>
    </div>
  );
}
