<p align="center">
  <a href="https://kamapathy.app"><img src="public/kamapathy-mark.svg" alt="Kamapathy" width="84" /></a>
</p>

<h1 align="center">Kamapathy</h1>

<p align="center"><strong>A calm browser you share with your agents.</strong></p>

<p align="center">
  Keep your tabs tidy and your spaces separate. Let an agent work where you can see it,<br />
  take over with one click, and hand it back when you're ready.
</p>

<p align="center">
  <a href="https://kamapathy.app"><strong>Download</strong></a>
  &nbsp;·&nbsp;
  <a href="https://kamapathy.app/#demo"><strong>Try the live demo</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/automation.md">Agent guide</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/shayanmohd/kamapathy/issues">Feedback</a>
</p>

<p align="center">
  <a href="https://github.com/shayanmohd/kamapathy/actions/workflows/build.yml"><img src="https://github.com/shayanmohd/kamapathy/actions/workflows/build.yml/badge.svg" alt="Desktop build" /></a>
  <a href="https://github.com/shayanmohd/kamapathy/releases"><img src="https://img.shields.io/github/v/release/shayanmohd/kamapathy?include_prereleases&label=release&color=2f6b4f" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f6b4f" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-desktop-2f6b4f" alt="macOS, Windows and Linux" />
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/kamapathy-dark.png" />
  <img src="docs/images/kamapathy-light.png" alt="Kamapathy showing an article, with tabs across the top and one rounded address bar" width="100%" />
</picture>

<p align="center"><sub>Screenshots follow your GitHub theme. Switch between light and dark to see both.</sub></p>

## Why Kamapathy

Browsers were built for one person at a keyboard. Coding and research agents now want to browse too, and handing them your everyday browser means handing them your accounts. Kamapathy gives each agent a space of its own, keeps it in plain sight while it works, and leaves you in charge.

It is also simply a good browser: Chromium underneath, a small interface on top, and nothing that competes with the page.

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>Spaces that stay apart</h3>
      Work, personal and side projects each keep their own cookies and sign-ins. One shortcut lays every space out side by side.
    </td>
    <td width="33%" valign="top">
      <h3>Agents in plain sight</h3>
      A green ring and a small bar show when an agent is working. <b>Take over</b> pauses it, <b>Let agent continue</b> hands it back.
    </td>
    <td width="33%" valign="top">
      <h3>Quiet by design</h3>
      Tabs across the top, one address bar, one menu. No account, no feed, no telemetry. Light and dark themes with a single accent.
    </td>
  </tr>
</table>

## Take the tour

Each section opens to a screenshot. Want to click around instead? The [live demo](https://kamapathy.app/#demo) runs a working copy of the interface in your browser, agent included.

<details open>
<summary><strong>An agent at work</strong>: a ring around its page and a bar to stop it</summary>
<br />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/kamapathy-agents-dark.png" />
  <img src="docs/images/kamapathy-agents-light.png" alt="An agent's page framed by a green ring, with a bar underneath offering Take over and Stop all agents" width="100%" />
</picture>
</details>

<details>
<summary><strong>All your spaces at once</strong>: Option+S on macOS, Alt+S elsewhere</summary>
<br />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/kamapathy-spaces-dark.png" />
  <img src="docs/images/kamapathy-spaces-light.png" alt="A grid of spaces with a live capture of each one, including an agent's space" width="100%" />
</picture>
</details>

<details>
<summary><strong>Split view</strong>: two live pages in one window</summary>
<br />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/kamapathy-split-dark.png" />
  <img src="docs/images/kamapathy-split-light.png" alt="Two pages side by side in one window" width="100%" />
</picture>
</details>

<details>
<summary><strong>The command menu</strong>: jump to any tab or action from the keyboard</summary>
<br />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/kamapathy-command-dark.png" />
  <img src="docs/images/kamapathy-command-light.png" alt="The command menu listing open tabs across spaces and browser actions" width="100%" />
</picture>
</details>

<details>
<summary><strong>A quiet new tab</strong>: a search box and your shortcuts</summary>
<br />
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/kamapathy-newtab-dark.png" />
  <img src="docs/images/kamapathy-newtab-light.png" alt="The new tab page with a centered search box and a row of shortcut tiles" width="100%" />
</picture>
</details>

## Get Kamapathy

Download the latest build from **[kamapathy.app](https://kamapathy.app)**, which picks the right file for your computer, or from [GitHub Releases](https://github.com/shayanmohd/kamapathy/releases).

| Your computer | Download |
| --- | --- |
| Mac with Apple silicon or Intel | DMG or ZIP |
| Windows 10 or 11, x64 | Installer or portable EXE |
| Linux, x64 | AppImage or Debian package |

Every release also carries the agent skill as a ZIP and a `SHA256SUMS.txt` file for checking downloads.

<details>
<summary><strong>Opening it the first time</strong>: this preview isn't signed with a paid certificate yet</summary>
<br />

**macOS.** Drag Kamapathy into Applications and open it. When macOS says it can't verify the app, click **Done**, then open **System Settings > Privacy & Security** and click **Open Anyway**. You only do this once.

**Windows.** If SmartScreen says it protected your PC, click **More info**, then **Run anyway**.

**Linux.** Make the AppImage executable with `chmod +x Kamapathy-*.AppImage` and run it, or install the Debian package with `sudo apt install ./Kamapathy-*.deb`.

</details>

## Bring your own agent

Kamapathy doesn't ship an AI model. It is the browser your agent uses, through a small Node.js client and a ready-made skill for Claude Code, Codex and anything else that can run a command.

```mermaid
sequenceDiagram
    autonumber
    participant A as Your agent
    participant K as Kamapathy
    participant Y as You
    A->>K: space create "Dinner booking"
    A->>K: open, snapshot, fill the form
    K-->>Y: the ring and the agent bar show every step
    A->>K: handoff, because the site wants a sign-in
    K-->>Y: You're in control
    Y->>K: sign in, then Let agent continue
    A->>K: resume, snapshot, confirm the booking
    Note over Y,K: Take over or Stop all agents at any time
```

Install the skill from a source checkout:

```sh
npm ci
npm run skill:install                                          # Codex
npm run skill:install -- --destination ~/.claude/skills/kamapathy   # Claude Code
```

Then ask your agent to use Kamapathy. It connects on its own, with no token to copy, and starts Kamapathy if it isn't running. A typical session looks like this:

```console
$ node kamapathy.mjs space create "Dinner booking"
space 8c1f2e04 "Dinner booking" agent
$ node kamapathy.mjs open 8c1f2e04 https://table.example/reserve
tab 51a9d7c3 https://table.example/reserve
$ node kamapathy.mjs snapshot 51a9d7c3
Reserve a table
https://table.example/reserve

Controls:
@e1 textbox "Name"
@e2 combobox "Party size"
@e3 button "Reserve"
```

<details>
<summary><strong>What agents can and can't do</strong></summary>
<br />

- Agents only reach the spaces they create, or ones you hand them. Your own tabs and sign-ins stay out of reach, and each agent space has its own temporary session that disappears when you quit.
- Snapshots are compact: visible text plus controls with short refs such as `@e12`, their state and current values. Password, one-time code and card fields read as `(value hidden)`.
- Agents can click, fill, select files, press keys, drag, scroll, wait for changes and run several steps in one batch.
- The connection is a Unix socket or Windows named pipe that only your account can open. Turning off **Agent access** in Settings refuses every agent at once.
- Snapshots cover the top document. Iframes, shadow roots, canvas editors and JavaScript dialogs need other handling.

The [agent guide](docs/automation.md) covers every command and its limits, and the [security model](docs/SECURITY.md) explains the isolation boundaries.

</details>

## Keyboard shortcuts

<details>
<summary><strong>The full list</strong></summary>
<br />

| Action | macOS | Windows and Linux |
| --- | --- | --- |
| Search tabs and commands | ⌘K | Ctrl+K |
| New tab | ⌘T | Ctrl+T |
| Reopen closed tab | ⇧⌘T | Ctrl+Shift+T |
| Close tab | ⌘W | Ctrl+W |
| Next or previous tab | Ctrl+Tab, Ctrl+Shift+Tab | Ctrl+Tab, Ctrl+Shift+Tab |
| All spaces | ⌥S | Alt+S |
| Focus the address bar | ⌘L | Ctrl+L |
| Find in page | ⌘F | Ctrl+F |
| Bookmark this page | ⌘D | Ctrl+D |
| Bookmarks | ⇧⌘B | Ctrl+Shift+B |
| History | ⌘Y | Ctrl+H |
| Downloads | ⇧⌘J | Ctrl+Shift+J |
| Reload | ⌘R | Ctrl+R |
| Zoom in, out, reset | ⌘+, ⌘-, ⌘0 | Ctrl+Plus, Ctrl+-, Ctrl+0 |
| Settings | ⌘, | Ctrl+, |
| Developer tools | F12 | F12 |

</details>

## Build it yourself

Kamapathy is Electron, React and TypeScript. Web pages run in native Chromium views, while the interface and the agent connection live in separate layers. The [architecture notes](docs/architecture.md) explain how they fit together.

```sh
git clone https://github.com/shayanmohd/kamapathy.git
cd kamapathy
npm ci
npm run dev
```

You need Node.js 22.12 or newer. The first run prepares a desktop runtime with Kamapathy's own name and icon, and later runs reuse it.

<details>
<summary><strong>Test and package</strong></summary>
<br />

```sh
npm run check          # types, unit tests and the copy check
npm run build          # compile the desktop app
npm run test:desktop   # drive the real app through every surface
npm run test:skill     # run the agent skill end to end against a local site
npm run test:native    # launch the app the way a person would
```

On Linux without a desktop session, prefix the desktop and skill tests with `xvfb-run -a`. Build installers on their own operating system with `npm run package:mac`, `npm run package:win` or `npm run package:linux`; they land in `release/`.

Every push to `main` and every pull request runs the **Build desktop apps** workflow, which tests and packages Apple silicon and Intel Macs, Windows x64 and Linux x64. Publishing is a separate, manual step described in the [release guide](docs/releases.md).

</details>

<details>
<summary><strong>Where things live</strong></summary>
<br />

| Folder | What it holds |
| --- | --- |
| `electron/` | The main process: tabs and spaces, the agent API and its socket, menus, saved state |
| `src/` | The interface: tab strip, toolbar, spaces, dialogs, command menu, styles |
| `shared/` | State, types and URL rules used on both sides |
| `skills/kamapathy/` | The agent skill and its standalone Node.js client |
| `scripts/` | Development runtime, end-to-end tests, screenshots and release tools |
| `site/` | The kamapathy.app website, including the live demo |
| `tests/` | Unit and integration tests |
| `docs/` | The agent guide, architecture, security model and release guide |

</details>

## What's not here yet

Kamapathy is an early preview. Browser extensions, a password manager, sync, an ad blocker and DRM playback are not part of it yet, and it hasn't had an independent security audit. If Google rejects a sign-in, Kamapathy offers to continue in your default browser instead.

## Contributing

Bug reports and focused pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), or [open an issue](https://github.com/shayanmohd/kamapathy/issues) with your operating system, the steps to reproduce and what you expected.

## License

[MIT](LICENSE)
