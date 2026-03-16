# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] - 2026-03-16

### Changed

- Reissued the clean post-`manager-gui` release so the published package, Git tag, and install verification all align on the same state

## [0.4.0] - 2026-03-16

### Changed

- **BREAKING**: removed the experimental `manager-gui` surface so the package returns to a clean thread-storage/inspection scope
- Added a first-class importable library entry (`dist/index.js`) for programmatic thread operations

## [0.3.0] - 2026-03-14

### Added

- `manager-gui`: optional access-code protection via `--auth-token <token>`, `--auth-token auto`, or `THREAD_INBOX_MANAGER_GUI_TOKEN`
- `manager-gui`: first-use onboarding card for empty workspaces and clearer Japanese status labels in the inbox UI
- `manager-gui`: `--no-open-browser` flag so other launchers can start the server without opening a local browser window
- `manager-gui`: browser-side DOM regression coverage for row patching, detail draft preservation, and in-browser access-code unlock flow

### Changed

- `manager-gui`: source-mode asset resolution now falls back to `dist/public/manager-app.js`, improving local dev/test execution paths
- `verify`: now includes `npm audit`, and the lockfile has been refreshed to eliminate the current high-severity advisories from the dependency tree

## [0.2.1] - 2026-02-23

### Fixed

- CLI version is now read from package.json at runtime instead of being hardcoded

## [0.2.0] - 2026-02-23

### Changed

- **BREAKING**: Thread status is now explicit instead of auto-computed from last message sender
  - Stored statuses expanded: `active`, `resolved`, `waiting`, `needs-reply`, `review`
  - AI messages no longer auto-set status to `needs-reply`; status is unchanged by default
  - User messages auto-set status to `waiting` (AI should respond)
- `inbox` command now shows both `needs-reply` and `review` threads (user action required)
- `list --status` accepts: `active`, `resolved`, `waiting`, `needs-reply`, `review`, `inbox`

### Added

- `--status` flag on `add` command to explicitly set thread status (e.g., `--status needs-reply`, `--status review`)
- `review` status for threads that need user review (completion reports, results)
- `inbox` meta-filter that matches `needs-reply` and `review` threads
- GUI: "Inbox" filter tab, "Review" filter tab, status selector for AI messages
- GUI: purple badge for `review` status, tooltips on filter tabs

## [0.1.1] - 2026-02-23

### Added

- `gui` command: web-based GUI for managing threads (dark theme, Tailwind CSS)
  - Thread list with status filter tabs (All / Needs Reply / Waiting / Resolved)
  - Expandable thread detail with message history
  - Add message form with user/ai sender toggle
  - Auto-refresh every 5 seconds

## [0.1.0] - 2026-02-23

### Added

- Initial release of `@metyatech/thread-inbox`
- CLI tool (`thread-inbox`) for managing threaded conversation inboxes
- `new` command: create a new thread with a title
- `list` command: list threads with optional `--status` filter
- `show` command: display thread details and messages
- `add` command: add a message to a thread (`--from user` or `--from ai`)
- `inbox` command: shortcut for `list --status needs-reply`
- `resolve` command: mark a thread as resolved
- `reopen` command: reopen a resolved thread
- `purge` command: remove resolved threads (`--dry-run` supported)
- JSONL-based local storage (`.threads.jsonl`) in working directory
- Colorized terminal output via chalk
- `--json` flag on all read commands
- `--dir` flag on all commands for custom working directory
- 59 unit tests with vitest
- TypeScript ESM build via tsup
- ESLint + Prettier code quality setup
