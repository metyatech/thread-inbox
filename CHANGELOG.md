# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-23

### Added

- Initial release of `@metyatech/thread-inbox`
- CLI tool (`thread-inbox`) for managing threaded conversation inboxes
- `create` command: create a new thread with a title
- `list` command: list all threads (with optional `--all` flag to include archived)
- `read` command: display messages in a thread
- `reply` command: add a reply to a thread
- `archive` command: archive a thread
- `delete` command: delete a thread permanently
- JSONL-based local storage in `~/.thread-inbox/threads.jsonl`
- Colorized terminal output via chalk
- 59 unit tests with vitest
- TypeScript ESM build via tsup
- ESLint + Prettier code quality setup
