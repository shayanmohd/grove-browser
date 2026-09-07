import {
  Plus,
  MagnifyingGlass,
  SidebarSimple,
  DotsThree,
  X,
  TreeEvergreen,
  Cpu,
  GearSix,
  BookmarkSimple,
  ClockCounterClockwise,
  DownloadSimple,
  PushPin,
  House,
  Briefcase,
  Stack,
  Hand,
} from "@phosphor-icons/react";
import type { BrowserAction, BrowserState } from "../../shared/types";
import { HOME_URL } from "../../shared/state";
import { Brand, IconButton, SiteIcon } from "./ui";

interface Props {
  state: BrowserState;
  collapsed: boolean;
  onToggle: () => void;
  dispatch: (action: BrowserAction) => void;
  onCommand: () => void;
  onPanel: (panel: string) => void;
  onSpace: () => void;
  onTabMenu: (id: string) => void;
}
export function Sidebar({
  state,
  collapsed,
  onToggle,
  dispatch,
  onCommand,
  onPanel,
  onSpace,
  onTabMenu,
}: Props) {
  const space = state.spaces.find((item) => item.id === state.activeSpaceId)!;
  const tabs = state.tabs.filter((tab) => tab.spaceId === state.activeSpaceId);
  const personalSpaces = state.spaces.filter(
    (item) => item.kind === "personal",
  );
  const agentSpaces = state.spaces.filter((item) => item.kind === "agent");
  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      aria-label="Browser sidebar"
    >
      <div className="sidebar-brand drag-region">
        <Brand compact={collapsed} />
        <IconButton label="Collapse sidebar" onClick={onToggle}>
          <SidebarSimple size={19} />
        </IconButton>
      </div>
      <button className="sidebar-search" onClick={onCommand}>
        <MagnifyingGlass size={18} />
        <span>Search anything</span>
        <kbd>{state.platform === "darwin" ? "⌘ K" : "Ctrl K"}</kbd>
      </button>
      <div className="spaces-heading">
        <span>Your spaces</span>
        <IconButton label="Create a space" onClick={onSpace}>
          <Plus size={15} />
        </IconButton>
      </div>
      <div className="spaces-list">
        {personalSpaces.map((item) => (
          <button
            key={item.id}
            className={`space-button color-${item.color} ${item.id === space.id ? "active" : ""}`}
            title={item.name}
            onClick={() => dispatch({ type: "space:activate", id: item.id })}
          >
            <span className="space-icon">
              {item.id === "personal" ? (
                <House
                  size={17}
                  weight={item.id === space.id ? "fill" : "regular"}
                />
              ) : item.id === "work" ? (
                <Briefcase size={17} />
              ) : (
                <Stack size={17} />
              )}
            </span>
            <span>{item.name}</span>
            <small>
              {state.tabs.filter((tab) => tab.spaceId === item.id).length}
            </small>
          </button>
        ))}
      </div>
      <div className="tabs-section">
        <div className="tabs-heading">
          <span>
            {space.kind === "agent" ? space.name : "Tabs"}
            <span className="tab-count">{tabs.length}</span>
          </span>
          <IconButton
            label="Manage this space"
            onClick={() => onPanel("manage-space")}
          >
            <DotsThree size={20} weight="bold" />
          </IconButton>
        </div>
        <div
          className="tab-list"
          role="tablist"
          aria-label={`${space.name} tabs`}
          aria-orientation="vertical"
        >
          {[...tabs]
            .sort((a, b) => Number(b.pinned) - Number(a.pinned))
            .map((tab) => (
              <div
                key={tab.id}
                className={`tab-row ${tab.id === state.activeTabId ? "active" : ""} ${tab.id === state.splitTabId ? "in-split" : ""}`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onTabMenu(tab.id);
                }}
              >
                <button
                  role="tab"
                  aria-selected={tab.id === state.activeTabId}
                  className="tab-select"
                  title={tab.title}
                  onClick={() => dispatch({ type: "tab:activate", id: tab.id })}
                >
                  <span
                    className={`tab-favicon ${tab.loading ? "loading" : ""}`}
                  >
                    {tab.url === HOME_URL ? (
                      <TreeEvergreen size={17} />
                    ) : (
                      <SiteIcon url={tab.url} size={17} />
                    )}
                  </span>
                  <span>{tab.title}</span>
                  {tab.pinned && <PushPin size={12} weight="fill" />}
                </button>
                <IconButton
                  label={`Close ${tab.title}`}
                  className="tab-close"
                  onClick={() => dispatch({ type: "tab:close", id: tab.id })}
                >
                  <X size={13} />
                </IconButton>
              </div>
            ))}
        </div>
        <button
          className="new-tab-button"
          title="New tab"
          onClick={() => dispatch({ type: "tab:create" })}
        >
          <Plus size={18} />
          <span>New tab</span>
          <kbd>{state.platform === "darwin" ? "⌘ T" : "Ctrl T"}</kbd>
        </button>
      </div>
      <div className="sidebar-bottom">
        <button
          className={`agent-nav ${agentSpaces.length ? "has-spaces" : ""}`}
          title="Agent studio"
          onClick={() => onPanel("agents")}
        >
          <Cpu size={19} />
          <span>Agent studio</span>
          {agentSpaces.length ? (
            <span className="agent-count">{agentSpaces.length}</span>
          ) : (
            <span className="agent-arrow">↗</span>
          )}
        </button>
        {agentSpaces.length > 0 && !collapsed && (
          <div className="agent-space-list">
            {agentSpaces.map((item) => (
              <button
                key={item.id}
                className={item.id === space.id ? "selected" : ""}
                onClick={() =>
                  dispatch({ type: "space:activate", id: item.id })
                }
              >
                <span>
                  {item.owner === "human" ? (
                    <Hand size={13} />
                  ) : (
                    <Cpu size={13} />
                  )}
                </span>
                {item.name}
              </button>
            ))}
          </div>
        )}
        <div className="sidebar-utilities">
          <IconButton label="Bookmarks" onClick={() => onPanel("bookmarks")}>
            <BookmarkSimple size={18} />
          </IconButton>
          <IconButton label="History" onClick={() => onPanel("history")}>
            <ClockCounterClockwise size={18} />
          </IconButton>
          <IconButton label="Downloads" onClick={() => onPanel("downloads")}>
            <DownloadSimple size={18} />
          </IconButton>
          <span />
          <IconButton label="Settings" onClick={() => onPanel("settings")}>
            <GearSix size={19} />
          </IconButton>
        </div>
        <div className="profile-row">
          <span className="profile-avatar">G</span>
          <div>
            <strong>Your little corner</strong>
            <small>Saved on this device</small>
          </div>
          <LeafBadge />
        </div>
      </div>
    </aside>
  );
}
function LeafBadge() {
  return <TreeEvergreen size={17} className="profile-leaf" />;
}
