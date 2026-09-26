// New interface text lives here so renaming the product touches one file.
export const toolsMenuCopy = {
  label: "Browser menu",
  "new-tab": "New tab",
  space: "New space",
  command: "Search tabs & commands",
  bookmarks: "Bookmarks",
  history: "History",
  downloads: "Downloads",
  split: "Split view",
  find: "Find",
  settings: "Settings",
} as const;

export const tabStripCopy = {
  search: "Search tabs",
  filter: "Filter tabs",
  noMatches: "No matching tabs",
  newTab: "New tab",
} as const;

export const settingsCopy = {
  agents: "Agents",
  access: "Agent access",
  spaces:
    "Agent spaces have separate cookies and disappear when you quit. Take over at any time.",
  activity: "Recent activity",
  noActivity: "Actions will appear here when an agent gets to work.",
} as const;

export const agentBarCopy = {
  status: {
    browsing: "Agent is browsing",
    idle: "Agent is idle",
    paused: "Agent access is off",
    "in-control": "You're in control",
    "needs-you": "You're in control",
  },
  takeOver: "Take over",
  letContinue: "Let agent continue",
  stop: "Stop all agents",
  confirmStop: "Stop every agent and turn off agent access?",
  cancel: "Cancel",
} as const;

export const spacesCopy = {
  menu: "Spaces",
  button: (space: string, working: number, needsYou: boolean) =>
    [
      `Spaces: ${space}`,
      working ? `${working} ${working === 1 ? "agent" : "agents"} working` : "",
      needsYou ? "an agent needs you" : "",
    ]
      .filter(Boolean)
      .join(", "),
  agents: "Agents",
  yours: "Your spaces",
  accessOff: "Agent access is off · Turn on",
  newSpace: "New space",
  tabs: (count: number) => `${count} ${count === 1 ? "tab" : "tabs"}`,
  details: (name: string) => `Details for ${name}`,
  options: (name: string) => `Options for ${name}`,
  rename: "Rename",
  nameLabel: "Space name",
  colour: "Colour",
  close: "Close space",
  confirmClose: "Confirm close",
  closeWarning: "This closes every tab in this space and removes its session.",
  viewAll: "View all",
  noActivity: "Nothing has happened here yet.",
  activityTitle: (name: string) => `${name} activity`,
  kind: "Kind of space",
  personal: "Personal",
  agent: "Agent",
} as const;

export const statusCopy = {
  browsing: "Browsing",
  idle: "Idle",
  "needs-you": "Needs you",
  "in-control": "You're in control",
  paused: "Agent access is off",
} as const;

export const overviewCopy = {
  title: "All spaces",
  count: (count: number) => `${count} ${count === 1 ? "space" : "spaces"}`,
  close: "Close all spaces",
  open: (name: string) => `Open ${name}`,
  rename: (name: string) => `Rename ${name}`,
  closeSpace: (name: string) => `Close ${name}`,
  confirmClose: (name: string) => `Confirm closing ${name}`,
  newSpace: "New space",
  create: "Create space",
  placeholder: "e.g. Weekend project",
} as const;

export const newTabCopy = {
  shortcuts: "Shortcuts",
  add: "Add shortcut",
  menu: (title: string) => `${title} shortcut`,
  edit: "Edit",
  remove: "Remove",
  editTitle: "Edit shortcut",
  editDescription: "Change the name or address of this shortcut.",
  save: "Save shortcut",
  saved: "Shortcut saved.",
} as const;
