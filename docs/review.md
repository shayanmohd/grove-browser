# Local review of Grove 0.1.0

Reviewed on September 7, 2026, on an Apple Silicon Mac running macOS 15.7.2, Node.js 24.19.0, and Electron 44.2.0. This is a development review, not an independent security certification.

## Results

| Check | Local result |
| --- | --- |
| TypeScript | Passed |
| Unit and integration behavior tests | 94 passed |
| Native Electron smoke | 22 checks passed |
| Grove skill end to end | 20 checks passed, 49 client commands |
| Installed Grove skill | The same 20 checks passed using the installed copy |
| Public sites through the skill | Example.com, MDN, and Wikipedia opened and were read successfully |
| Desktop production compilation | Passed |
| Web preview production compilation | Passed |
| macOS ARM64 packaging | DMG and ZIP built successfully |
| Packaged macOS app with installed skill | All 20 skill checks passed against `Grove.app` |
| Dependency audit | No reported vulnerabilities in `npm audit` on the review date |
| Skill metadata validation | Passed the skill-creator validator |
| Authored punctuation scan | Passed, including captured fixture text |

The native smoke suite exercises the real desktop bridge, UI space creation, theme controls, command palette keyboard navigation, remote page isolation, back navigation, bookmarks, two native split panes, focused-pane controls, dialog occlusion, page recovery, separate storage, API authentication, explicit grants, handoff, restart persistence, deleted-space cookie cleanup, and macOS window recreation.

The skill test launches a temporary desktop profile and connects the bundled standalone client using a protected credential file. Playwright starts the desktop shell and enables or resumes the test connection. All website navigation, observations, form input, clicks, scrolling, waits, screenshots, and cleanup in this suite go through the skill's client and Grove's public HTTP interface. No test-only page evaluation endpoint is used for those actions.

## Form workflow

The [local fixture](../tests/fixtures/form-site.mjs) serves an actual form builder and handles POST requests and redirects. The skill creates a form named `Release feedback`, fills a name, fictional email, topic select, priority radio, feedback textarea, dynamically added project context, and consent checkbox. It submits one response, waits for the receipt, and verifies the server recorded exactly one form creation and exactly one response with the expected values. Personal browsing selection remains unchanged.

Additional cases verify required-field validation, read-only and disabled controls, password-value omission, detached elements, refs invalidated by navigation, contenteditable input, scoped observations, asynchronous waits, timeout handling, offscreen clicks, Enter-key submission, PNG output, refusal to overwrite a screenshot, and handoff denial until explicit UI resume. A failing batch returns completed steps and stops without running later actions.

Live public websites were read only. All test form submissions used fictional data on a temporary loopback server. The tests remove temporary profiles and connection files. Generated results are in ignored `artifacts/review`; no live credentials or personal profile data belong in the repository.

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

## Token measurements and limits

The [benchmark report](benchmarks.md) compares captured outputs against ego-browser 0.4.7.3 on the same four local pages. Grove used 49.1% fewer snapshot tokens without truncating those pages. The report includes captured text and a tokenizer script. It does not establish a universal reliability ranking or total model-token savings.

Windows x64, Linux x64, and Intel macOS have native CI test and packaging jobs. This local report does not substitute for those jobs or tests on the owner's physical Windows and Linux devices. Use the [device guide](device-testing.md) for installation and manual checks.

Remaining limits include unsigned development packages, no automatic updates, no shared personal login state for agents, no iframe or shadow-root automation, no canvas-editor or file-upload actions, and no extension, password-manager, sync, or DRM compatibility guarantee. A small set of public website reads cannot establish compatibility with every website. The skill's static instructions received a separate fresh-reader review; the executed local suite was run by the implementing agent.
