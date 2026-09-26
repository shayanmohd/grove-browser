# Test Kamapathy on your devices

Kamapathy uses the same source on macOS, Windows, and Linux. The GitHub desktop workflow builds a native package for each supported runner. A successful CI run verifies its runner environment; testing your own graphics, display scaling, and desktop integration still matters.

For the easiest installation, open [Kamapathy Releases](https://github.com/shayanmohd/kamapathy/releases), download the file matching your operating system and CPU, and follow the platform guidance below. Each published preview includes a standalone skill ZIP and `SHA256SUMS.txt`.

## Windows

Install Git and Node.js 22.12 or newer. In PowerShell:

```powershell
git clone https://github.com/shayanmohd/kamapathy.git
cd kamapathy
npm ci
npm run check
npm run build
npm run test:desktop
npm run test:skill
npm start
```

Use `npm run package:win` to create a local installer and portable EXE in `release`. Alternatively, download `Kamapathy-win-x64` from a successful **Build desktop apps** run in the repository's Actions tab, extract the artifact ZIP, and run the installer. The portable EXE runs without installation. These are unsigned development binaries, so Windows may show an unknown-publisher prompt. Do not disable Windows security globally.

To include public website reads in the skill test:

```powershell
$env:KAMAPATHY_TEST_PUBLIC = '1'
npm run test:skill
Remove-Item Env:KAMAPATHY_TEST_PUBLIC
```

## Linux

On Ubuntu 22.04, install the desktop dependencies and use Node.js 22.12 or newer:

```sh
sudo apt-get update
sudo apt-get install -y git xvfb libgtk-3-0 libnss3 libasound2 libgbm1 libxss1 libxtst6 libsecret-1-0
git clone https://github.com/shayanmohd/kamapathy.git
cd kamapathy
npm ci
npm run check
npm run build
xvfb-run -a npm run test:desktop
xvfb-run -a npm run test:skill
npm start
```

Run `npm start` in your desktop session. `xvfb-run` supplies a virtual display for tests. On distributions with renamed libraries, use the distribution's corresponding packages.

Use `npm run package:linux` for AppImage and Debian packages. You can also download `Kamapathy-linux-x64` from a successful workflow run. For the AppImage, extract the ZIP, mark the file executable with `chmod +x release/Kamapathy-*.AppImage` if built locally, and launch it. The Debian package provides system integration on compatible distributions. Linux sandbox and AppImage support vary by distribution; report startup errors rather than running the browser with its sandbox disabled.

Public website checks are optional:

```sh
KAMAPATHY_TEST_PUBLIC=1 xvfb-run -a npm run test:skill
```

## Manual checks

1. Open a normal website, follow a link, and use back, forward, reload, find, and zoom.
2. Sign in to a site, create a space, and confirm the site is still signed in there. Turn on Separate sign-ins for that space from the Spaces popover and confirm the site asks you to sign in again.
3. Open two pages in split view, click each pane, and confirm address and zoom controls follow that pane.
4. Bookmark a page, restart Kamapathy, and check that your personal tabs and bookmark return.
5. Try a download, a new-window link, light and dark themes, and display scaling.
6. Install the skill with `npm run skill:install`. Run `node scripts/kamapathy.mjs health` from the installed skill and confirm it connects with no setup. Turn agent access off in Settings and confirm the client refuses to connect or start Kamapathy, then turn it back on. Confirm takeover pauses the agent, and that both Let agent continue in the agent bar and running `node scripts/kamapathy.mjs resume <space-id>` let it continue.

The automated skill test creates its own temporary profile and local form server, and connects through that profile's agent socket. It creates one form and submits one fictional response, verifies two additional forms that open new tabs, checks server receipts, and removes its temporary data. It never submits a live external form. Share the failing command, operating system, CPU architecture, and error text when reporting a problem. Keep profiles private.
