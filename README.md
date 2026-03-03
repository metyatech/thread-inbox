# @metyatech/thread-inbox

> Threaded conversation inbox for managing user-AI interactions

A local CLI tool that tracks threaded conversations between a user and AI agents. Each thread represents a topic (question, request, discussion). Messages are added to threads. The tool shows what needs attention, what's waiting, and what's resolved.

[![CI](https://github.com/metyatech/thread-inbox/actions/workflows/ci.yml/badge.svg)](https://github.com/metyatech/thread-inbox/actions/workflows/ci.yml)

## Prerequisites

- **Node.js**: >= 18.0.0
- **Storage**: Local filesystem (JSONL)

## Installation

```bash
npm install -g @metyatech/thread-inbox
```

## Usage

### Summary of Commands

| Command   | Description                | Example                             |
| --------- | -------------------------- | ----------------------------------- |
| `new`     | Create a new thread        | `thread-inbox new "Plan topics"`    |
| `list`    | List all threads           | `thread-inbox list --status active` |
| `inbox`   | List threads needing reply | `thread-inbox inbox`                |
| `show`    | Show thread details        | `thread-inbox show abc12345`        |
| `add`     | Add a message              | `thread-inbox add abc12345 "Ok"`    |
| `resolve` | Mark as resolved           | `thread-inbox resolve abc12345`     |
| `reopen`  | Reopen a thread            | `thread-inbox reopen abc12345`      |
| `purge`   | Remove resolved threads    | `thread-inbox purge`                |

### Detailed Usage

#### `new <title>`

Create a new thread with a descriptive title.

- **Arguments**:
  - `<title>` (Required): The title of the conversation thread.
- **Options**:
  - `--dir <path>`: Working directory (default: current working directory).
  - `--json`: Output the created thread object as JSON.
- **Example**:
  ```bash
  thread-inbox new "Topics bulk assignment"
  # Output: abc12345 (thread ID)
  ```

#### `list`

List threads based on status and directory.

- **Options**:
  - `--status <status>`: Filter by status (`active`, `resolved`, `needs-reply`, `waiting`).
  - `--dir <path>`: Working directory (default: current working directory).
  - `--json`: Output as JSON list.
- **Example**:
  ```bash
  thread-inbox list --status needs-reply
  ```

#### `inbox`

Alias for `list --status needs-reply`. Shows threads where the AI sent the last message and requires user input.

- **Options**: Same as `list`.
- **Example**:
  ```bash
  thread-inbox inbox
  ```

#### `show <id>`

Display full conversation history for a specific thread.

- **Arguments**:
  - `<id>` (Required): The thread ID.
- **Options**:
  - `--dir <path>`: Working directory (default: current working directory).
  - `--json`: Output the thread object as JSON.
- **Example**:
  ```bash
  thread-inbox show abc12345
  ```

#### `add <id> <message>`

Add a new message to an existing thread.

- **Arguments**:
  - `<id>` (Required): The thread ID.
  - `<message>` (Required): The message content.
- **Options**:
  - `--from <sender>`: Sender type, either `user` or `ai` (default: `user`).
  - `--dir <path>`: Working directory (default: current working directory).
  - `--json`: Output the updated thread object as JSON.
- **Example**:
  ```bash
  thread-inbox add abc12345 "Looks good to me"
  thread-inbox add abc12345 "I'll proceed with that plan" --from ai
  ```

#### `resolve <id>` / `reopen <id>`

Change the status of a thread.

- **Arguments**:
  - `<id>` (Required): The thread ID.
- **Options**:
  - `--dir <path>`: Working directory (default: current working directory).
  - `--json`: Output the updated thread object as JSON.
- **Example**:
  ```bash
  thread-inbox resolve abc12345
  thread-inbox reopen abc12345
  ```

#### `purge`

Permanently remove all threads marked as `resolved`.

- **Options**:
  - `--dry-run`: Show which threads would be removed without deleting them.
  - `--dir <path>`: Working directory (default: current working directory).
  - `--json`: Output the list of purged threads as JSON.
- **Example**:
  ```bash
  thread-inbox purge --dry-run
  ```

## Data Model

Threads are stored in a single JSONL file (`.threads.jsonl`) in the specified working directory.

### Status Logic

- **active**: Thread is open.
- **resolved**: Thread is closed.
- **needs-reply**: Active thread where the last message is from the AI.
- **waiting**: Active thread where the last message is from the user.

## Development

- **Installation**: `npm install`
- **Build**: `npm run build`
- **Verification**: `npm run verify` (runs format check, linting, build, and tests)
- **Format**: `npm run format`
- **Test**: `npm run test`

## Compliance & Documentation

This repository follows [metyatech's standards](AGENTS.md).

- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [License](LICENSE)

## License

MIT © metyatech
