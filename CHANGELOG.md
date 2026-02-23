# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
