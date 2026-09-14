<p align="center">
  <img src="public/grove-mark.svg" alt="" width="80" />
</p>

<h1 align="center">Grove</h1>

<p align="center"><strong>A little more room to think.</strong></p>
<p align="center">A desktop browser with quiet spaces for you and your agents.<br />Made for macOS, Windows, and Linux.</p>

<p align="center">
  <a href="https://github.com/shayanmohd/grove-browser/releases"><strong>Download Grove</strong></a>
  &nbsp; · &nbsp;
  <a href="docs/automation.md">Meet the agent API</a>
  &nbsp; · &nbsp;
  <a href="https://github.com/shayanmohd/grove-browser/issues">Share feedback</a>
</p>

<p align="center">
  <a href="https://github.com/shayanmohd/grove-browser/actions/workflows/build.yml"><img src="https://github.com/shayanmohd/grove-browser/actions/workflows/build.yml/badge.svg" alt="Desktop build status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-38654a?style=flat" alt="MIT license" /></a>
  <a href="docs/device-testing.md"><img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-38654a?style=flat" alt="macOS, Windows, and Linux" /></a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/grove-dark.png" />
  <img src="docs/images/grove-light.png" alt="Grove's desktop interface with a forest backdrop, vertical tabs, and separate browsing spaces" width="1440" />
</picture>

<p align="center"><sub>Your tabs, your spaces, a clear view of what comes next.</sub></p>

## Give your browsing some space

Keep work and personal sessions separate. Put two pages side by side. Let an agent work in its own visible space, then take over with a click. Grove brings these habits together in a Chromium desktop browser with a small, focused interface.

| Make room for | How Grove helps |
| --- | --- |
| **Different contexts** | Spaces keep cookies and site storage separate. Personal spaces return when you reopen the app. |
| **Clearer navigation** | Readable vertical tabs, pinned pages, and a keyboard command palette keep useful pages close. |
| **Side-by-side work** | Split view puts two live pages in one window, with controls that follow the pane you select. |
| **Everyday essentials** | Bookmarks, history, downloads, page search, zoom, and screenshots are built in. |
| **Visible automation** | Temporary agent spaces, an activity log, and human takeover keep browser actions in view. |
| **A quieter canvas** | Light, dark, and system themes share a forest backdrop and a restrained color palette. |

<details>
  <summary><strong>A closer look at agent spaces and keyboard commands</strong></summary>

<br />

![Agent studio with connection controls, task spaces, and visible activity](docs/images/grove-agents.png)

![Grove's command palette for finding tabs and running browser actions](docs/images/grove-command.png)

</details>

## Bring your own agent

Grove includes a [ready-to-install skill](skills/grove-browser/SKILL.md) and a standalone Node.js client. Agents can read compact page snapshots, address controls by short refs, fill forms, select files for upload, click, scroll, wait for changes, and batch sequential actions. No AI model or subscription is bundled with the browser.

The local connection is opt-in. Agent spaces use separate sessions, and human takeover pauses agent access until you return control. Read the [automation guide](docs/automation.md) for the interface and its limits.

From a source checkout, install the skill with:

```sh
npm ci
npm run skill:install
```

Start a new Codex session to discover `$grove-browser`. In Grove, open **Agent studio**, enable the connection, and follow the [connection setup](skills/grove-browser/references/connection.md). Releases also include a standalone skill ZIP. The client works with other agents that can run Node.js.

## Get Grove

[**Download the current preview from Releases →**](https://github.com/shayanmohd/grove-browser/releases)

| Your device | Available packages |
| --- | --- |
| macOS, Apple Silicon or Intel | DMG and ZIP |
| Windows, x64 | Installer and portable EXE |
| Linux, x64 | AppImage and Debian package |

Each published preview includes installer checksums and the Grove skill. The [device guide](docs/device-testing.md) covers installation, local builds, and checks to run on your own hardware.

Grove is an early, unsigned preview. Signing, notarization, and automatic updates are not configured.

## Built in the open

Grove uses Electron, React, and TypeScript. Websites run in native Chromium views, while the interface and agent connection stay in separate application layers. The [architecture notes](docs/architecture.md) explain that separation.

Every desktop build workflow validates the code, runs real Electron and skill-driven form tests, and packages four native targets: Apple Silicon Mac, Intel Mac, Windows x64, and Linux x64. The [review report](docs/review.md) records tested behavior, public website checks, and remaining limits. [Snapshot measurements](docs/benchmarks.md) include captured fixtures and a reproducible tokenizer script.

### Run from source

Use Node.js 22.12 or newer and npm:

```sh
git clone https://github.com/shayanmohd/grove-browser.git
cd grove-browser
npm ci
npm run dev
```

The first `npm run dev` or `npm start` prepares a desktop runtime with Grove's own app name and icon. Later launches reuse that cached copy. It lives under `node_modules/.cache/grove-runtime` and is refreshed when the runtime or branding changes.

<details>
  <summary><strong>Build, test, and package</strong></summary>

<br />

```sh
npm run check
npm run build
npm run test:desktop
npm run test:skill
npm start
```

On Linux without a desktop session, prefix the desktop and skill test commands with `xvfb-run -a`. The default tests create and submit forms on a temporary local server. Set `GROVE_TEST_PUBLIC=1` to add read-only checks of Example.com, MDN, and Wikipedia.

Build packages on their native operating system:

| Platform | Command |
| --- | --- |
| macOS | `npm run package:mac` |
| Windows | `npm run package:win` |
| Linux | `npm run package:linux` |

Installers are written to `release/`. Maintainers can follow the [publishing guide](docs/releases.md) to publish a reviewed build. Source pushes do not publish installers automatically.

</details>

<details>
  <summary><strong>Work on the interface in a web browser</strong></summary>

<br />

Run `npm run dev:web` for an interactive interface preview. Its controls use local preview state. Remote websites and the automation server require the desktop application.

The optional [web preview workflow](.github/workflows/preview.yml) can deploy that interface to GitHub Pages. Set the repository's **Settings > Pages** source to **GitHub Actions**, then run **Actions > Publish web preview** manually. The workflow supports repository subpaths and does not run automatically on pushes.

</details>

## What to expect

Grove focuses on browsing, isolated spaces, and agent handoff. Extension compatibility, a password manager, account sync, an ad blocker, DRM support, and a built-in AI assistant are outside the current implementation. Agent automation works with the top document; frames, shadow roots, canvas editors, and JavaScript dialogs need other handling. File selection supports up to 8 files totaling 16 MiB through a current file-input ref. Directories and sites requiring a trusted chooser or native file handles are unsupported. See the [automation guide](docs/automation.md#select-files-for-upload) for file handling and the [security model](docs/SECURITY.md) for isolation boundaries. Grove has not received an independent security audit.

**Google sign-in needs further verification.** Google rejected the initial Play Console test launched through the review harness. A normal desktop launch does not expose that harness's WebDriver flag and is being tested separately. Grove offers an explicit default-browser action on the rejection page; it does not transfer the login back into Grove. See the [compatibility review](docs/review.md#google-sign-in-compatibility).

Bug reports and focused contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), or [open an issue](https://github.com/shayanmohd/grove-browser/issues) with your operating system, steps to reproduce, and expected behavior.

---

<p align="center"><strong>Find your focus. Keep your space.</strong></p>

<p align="center"><sub>Created by <a href="https://github.com/shayanmohd">Mohd Shayan</a> · Open source under the <a href="LICENSE">MIT license</a></sub></p>

<details>
  <summary>Credits</summary>

The forest photograph is by [Luca Bravo on Unsplash](https://unsplash.com/photos/body-of-water-surrounded-by-pine-trees-during-daytime-ESkw2ayO2As), under the [Unsplash license](https://unsplash.com/license). Type uses [Geist](https://github.com/vercel/geist-font), and icons use [Phosphor](https://github.com/phosphor-icons/react). Their respective licenses apply to those assets.

</details>
