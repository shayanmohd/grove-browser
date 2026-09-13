# Local review of Grove 0.1.1

Reviewed on September 13, 2026, on an Apple Silicon Mac running macOS 15.7.2, Node.js 24.19.0, and Electron 44.2.0. This is a development review, not an independent security certification.

## Results

| Check | Local result |
| --- | --- |
| TypeScript | Passed |
| Unit and integration behavior tests | 134 passed |
| Native Electron smoke | 22 checks passed |
| Grove skill end to end | 29 checks passed, 108 client commands |
| Installed Grove skill | The same 29 checks passed using the installed copy |
| Public sites through the skill | Example.com, MDN, and Wikipedia opened and were read successfully |
| Desktop production compilation | Passed |
| Web preview production compilation | Passed |
| macOS ARM64 packaging | DMG and ZIP built successfully |
| Packaged macOS app with installed skill | All 29 skill checks passed against `Grove.app` |
| Native development identity | Grove bundle name, executable, menu, icon, external entry loading, and cached runtime passed |
| Responsive interface | 12 native size/theme/panel combinations passed, down to 850 by 600 |
| Dependency audit | No reported vulnerabilities in `npm audit` on the review date |
| Skill metadata validation | Passed the skill-creator validator |
| Authored punctuation scan | Passed, including captured fixture text |

The native smoke suite exercises the real desktop bridge, UI space creation, theme controls, command palette keyboard navigation, remote page isolation, back navigation, bookmarks, two native split panes, focused-pane controls, dialog occlusion, page recovery, separate storage, API authentication, explicit grants, handoff, restart persistence, deleted-space cookie cleanup, and macOS window recreation.

The skill test launches a temporary desktop profile and connects the bundled standalone client using a protected credential file. Playwright starts the desktop shell and enables or resumes the test connection. All website navigation, observations, form input, clicks, scrolling, waits, screenshots, and cleanup in this suite go through the skill's client and Grove's public HTTP interface. No test-only page evaluation endpoint is used for those actions.

## Form workflow

The [local fixture](../tests/fixtures/form-site.mjs) serves an actual form builder and handles POST requests and redirects. The skill creates a form named `Release feedback`, fills a name, fictional email, topic select, priority radio, feedback textarea, dynamically added project context, and consent checkbox. It submits one response, waits for the receipt, and verifies the server recorded exactly one form creation and exactly one response with the expected values. Personal browsing selection remains unchanged.

Additional cases verify required-field validation, read-only and disabled controls, password-value omission, detached elements, refs invalidated by navigation, contenteditable input, scoped observations, asynchronous waits, timeout handling, offscreen clicks, Enter-key submission, PNG output, refusal to overwrite a screenshot, and handoff denial until explicit UI resume. A failing batch returns completed steps and stops without running later actions.

Live public websites were read only. All completed test form submissions used fictional data on a temporary loopback server. The tests remove temporary profiles and connection files. Generated results are in ignored `artifacts/review`; no live credentials or personal profile data belong in the repository. The attempted live Play Console workflow stopped when Google rejected sign-in in Grove. No app was created or uploaded, and no end-to-end token comparison was completed.

## Branding, interface, and file selection

Source launches now prepare and reuse a native Grove runtime rather than opening the stock development executable. The installed Electron distribution stays intact. macOS uses the Grove bundle and Dock icon, Windows has an explicit application identity and icon, and Linux uses consistent desktop metadata. The branding test verifies the native executable, platform metadata, launch from a different working directory, and preserved development entry behavior. Native CI runs this check on each supported target.

Home now centers on its search, shortcuts, and actual recent pages. Repeated promotional copy, duplicate shortcut actions, redundant profile/status strips, and the extra agent card were removed. Agent setup details and activity use keyboard accessible disclosures. Native screenshots were checked at 1280 by 800, 980 by 700, and 850 by 600 in both themes with Home and Agent studio. There was no horizontal overflow, and all smaller-window content remained reachable by scrolling. README images were refreshed from the running desktop app.

The skill now selects files through a dedicated bounded upload route. The native suite sends a binary bundle larger than the normal API body limit and two image files, including a Unicode filename, through a real multipart POST. It verifies every received byte and exactly one receipt. It also checks hidden file inputs in visible upload UI, selected-filename omission, stale refs, disabled inputs, accepted types, and single-file constraints. Focused API and client regressions cover ownership during transfers, navigation, replaced pages, concurrency, interrupted transfers, base64 validation, size limits, and local-path privacy. Selection uses File and DataTransfer objects; a site can still require an unsupported native chooser interaction.

## Fixes made during review

- Removed WebContents event handlers could previously restore a page after navigation to Home. Current-view guards prevent these callbacks from mutating the tab.
- Split view could survive a new blank tab or Home navigation. Native and preview state now clear invalid split pairs.
- Clicking the secondary native pane could leave address and page controls targeting the other pane. Focus now updates the active tab while keeping pane positions stable.
- A failed or older navigation could overwrite a newer destination or display the previous URL. Navigation generations preserve the intended destination and make Try again retry it.
- Deleting an unopened restored workspace did not clear its persistent partition. Deletion now clears its stored cookies and site data.
- macOS window recreation could retain download callbacks from the previous controller. Disposal now releases those listeners, and a new window registers one current handler.
- The web preview could restore navigation buttons without a corresponding back stack, retain another workspace's split, or give duplicated tabs a fake history. Restore, activation, and duplication now maintain consistent state.
- Development launches reported Electron's version as Grove's version. The displayed and API version now comes from the application's package metadata.
- A rejected API grant could leave a space shown as agent-owned. Failure returns ownership to the human before surfacing the error.
- The skill installer used Unix-only path containment checks. It now uses the native path separator on Windows too.
- Windows CI exposed a Vitest parse failure when Git converted the standalone client's shebang file to CRLF. The same failure was reproduced locally with CRLF, and repository attributes now preserve LF text consistently on all platforms.
- After its browser and skill tests passed, Windows packaging exposed PowerShell argument splitting in a dotted electron-builder override. The homepage now lives in package metadata, and the workflow uses simple native platform arguments.
- Native split testing exposed two issues: the harness treated unresolved asynchronous state predicates as success, and background page navigation could retain focus before a pane became active. State waits now await and poll resolved values. Remote pages disable focus on navigation, pane clicks update the toolbar even when focus is unchanged, and native focus tests activate their desktop window explicitly.
- An intermittent Windows retry check prompted a regression for late loading notifications: generic loading events must preserve a failed page's error until an actual new navigation or explicit retry. The regression failed before the fix. The smoke fixture also keeps its failure active until the retry button is visible.

## September automation and form review

The [automation review](automation-review.md) records document tracking, operation ordering, form behavior, and remaining boundaries. The additional skill checks cover hidden and closed disclosure text, submit-input captions, select option values, disabled option groups, duplicate options, invalid dates and numbers, fields changed during focus, and empty or plaintext-only editable regions with Unicode text.

New-tab form tests submit URL-encoded and multipart bodies, including Unicode and reserved characters. They verify the exact server fields, referrer, background space, receipt page, and one request per form. Permission regressions cover separate microphone/camera grants, deleted spaces, and same-URL reloads while a prompt is pending. Saved-state tests cover duplicate identities, invalid URLs, corrupt preview data, and the tab limit across spaces.

The dependency review upgraded Vitest to 4.1.11 to address [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). The final local audit reported no vulnerabilities. This concerns development tooling; Grove does not expose a Vitest server in its desktop app.

## Google sign-in compatibility

A real Play Console sign-in attempt reached Google's rejected-browser page before the Console could load. Google documents that embedded and automated browsers may be blocked. This remains a compatibility limit of the current desktop engine. Grove now shows a concise notice with an explicit default-browser button on the rejection page. The button opens a fixed public Google destination, drops authentication query parameters, and transfers no cookies or credentials. Signing in there does not authenticate a Grove space. The API cannot invoke this external handoff. See [Google's supported-browser guidance](https://support.google.com/accounts/answer/7675428?co=GENIE.Platform%3DDesktop&hl=en).

## Token measurements and limits

The [snapshot report](benchmarks.md) measures 1,605 tokens across four captured local pages without truncation. The report includes captured text and a tokenizer script. It measures observation size, not total model-token consumption or reliability across the web.

Windows x64, Linux x64, and Intel macOS have native CI test and packaging jobs. This local report does not substitute for those jobs or tests on the owner's physical Windows and Linux devices. Use the [device guide](device-testing.md) for installation and manual checks.

Remaining limits include unsigned development packages, no automatic updates, no shared personal login state for agents, no iframe or shadow-root automation, no canvas-editor or JavaScript dialog actions, and no extension, password-manager, sync, or DRM compatibility guarantee. File selection does not support directories, native chooser events, or native file handles. A small set of public website reads cannot establish compatibility with every website. The skill instructions and upload boundary received separate reviews; the executed local suite was run by the implementing agent.
