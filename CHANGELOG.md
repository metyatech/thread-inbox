# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-23

### Added

- Initial release of `@metyatech/thread-inbox`
- CLI tool (`thread-inbox`) for managing threaded conversation inboxes
- `new` command: create a new thread with a title
- `list` command: list threads with optional status filtering
- `inbox` command: list threads needing reply (alias for `list --status needs-reply`)
- `show` command: display messages in a thread
- `add` command: add a message to a thread
- `resolve` command: mark a thread as resolved
- `reopen` command: reopen a resolved thread
- `purge` command: remove all resolved threads
- JSONL-based local storage in `.threads.jsonl` in the working directory
- Colorized terminal output via chalk
- Unit tests with vitest
- TypeScript ESM build via tsup
- ESLint + Prettier code quality setup
