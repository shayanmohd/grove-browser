import { useEffect, useRef, useState, type ReactNode } from "react";
import { CaretDown, Minus, Plus, Square, X } from "@phosphor-icons/react";
import type { BrowserAction, BrowserState, Tab } from "../../shared/types";
import { bridge, isDesktop } from "../lib/bridge";
import { filterTabs, spaceTabs } from "../lib/tabs";
import { tabStripCopy } from "../copy";
import { Popover } from "./Popover";
import { Favicon, IconButton } from "./ui";
import "./TabStrip.css";

export function TabStrip({
  state,
  dispatch,
  searchOpen,
  onSearch,
  onCloseSearch,
  onTabMenu,
  spaceButton,
}: {
  state: BrowserState;
  dispatch: (action: BrowserAction) => void;
  searchOpen: boolean;
  onSearch: () => void;
  onCloseSearch: () => void;
  onTabMenu: (id: string) => void;
  spaceButton?: ReactNode;
}) {
  const tabs = spaceTabs(state);
  const space = state.spaces.find((item) => item.id === state.activeSpaceId);
  const searchButton = useRef<HTMLButtonElement>(null);
  const activeTab = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [state.activeTabId, tabs.length]);
  return (
    <div className="tab-strip drag-region">
      <IconButton
        ref={searchButton}
        label={tabStripCopy.search}
        className="strip-search"
        aria-haspopup="menu"
        aria-expanded={searchOpen}
        onClick={searchOpen ? onCloseSearch : onSearch}
      >
        <CaretDown size={14} />
      </IconButton>
      <div
        className="strip-tabs"
        role="tablist"
        aria-label={`${space?.name ?? ""} tabs`}
      >
        {tabs.map((tab) => {
          const active = tab.id === state.activeTabId;
          return (
            <div
              key={tab.id}
              ref={active ? activeTab : undefined}
              className={`strip-tab ${active ? "active" : ""} ${tab.pinned ? "pinned" : ""} ${tab.id === state.splitTabId ? "in-split" : ""}`}
              onContextMenu={(event) => {
                event.preventDefault();
                onTabMenu(tab.id);
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={tab.title}
                title={tab.title}
                className="strip-tab-button"
                onClick={() => dispatch({ type: "tab:activate", id: tab.id })}
              >
                <Favicon tab={tab} size={14} />
                {!tab.pinned && <span>{tab.title}</span>}
              </button>
              {!tab.pinned && (
                <IconButton
                  label={`Close ${tab.title}`}
                  className="strip-tab-close"
                  onClick={() => dispatch({ type: "tab:close", id: tab.id })}
                >
                  <X size={11} />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>
      <IconButton
        label={tabStripCopy.newTab}
        className="strip-new-tab"
        onClick={() => dispatch({ type: "tab:create" })}
      >
        <Plus size={14} />
      </IconButton>
      <span className="strip-spacer" />
      {spaceButton}
      {isDesktop && state.platform !== "darwin" && (
        <div className="window-controls">
          <IconButton
            label="Minimize window"
            onClick={() => bridge.windowControl("minimize")}
          >
            <Minus size={14} />
          </IconButton>
          <IconButton
            label="Maximize window"
            onClick={() => bridge.windowControl("maximize")}
          >
            <Square size={11} />
          </IconButton>
          <IconButton
            label="Close window"
            className="window-close"
            onClick={() => bridge.windowControl("close")}
          >
            <X size={15} />
          </IconButton>
        </div>
      )}
      <Popover
        open={searchOpen}
        onClose={onCloseSearch}
        anchor={searchButton}
        label={tabStripCopy.search}
        className="tab-search"
      >
        <TabSearch
          tabs={tabs}
          activeTabId={state.activeTabId}
          onPick={(id) => {
            onCloseSearch();
            dispatch({ type: "tab:activate", id });
          }}
        />
      </Popover>
    </div>
  );
}

function TabSearch({
  tabs,
  activeTabId,
  onPick,
}: {
  tabs: Tab[];
  activeTabId: string;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = filterTabs(tabs, query);
  return (
    <>
      <input
        className="tab-search-input"
        data-autofocus
        aria-label={tabStripCopy.filter}
        placeholder={tabStripCopy.filter}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) {
            event.preventDefault();
            onPick(matches[0].id);
          }
        }}
      />
      {matches.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="menuitem"
          className={tab.id === activeTabId ? "current" : ""}
          onClick={() => onPick(tab.id)}
        >
          <Favicon tab={tab} size={14} />
          <span className="tab-search-title">{tab.title}</span>
        </button>
      ))}
      {!matches.length && (
        <p className="popover-empty">{tabStripCopy.noMatches}</p>
      )}
    </>
  );
}
