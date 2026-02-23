# thread-inbox

> Threaded conversation inbox for managing user-AI interactions

A local CLI tool that tracks threaded conversations between a user and AI agents. Each thread represents a topic (question, request, discussion). Messages are added to threads. The tool shows what needs attention, what's waiting, and what's resolved.

## Features

- 📋 **Thread Management** - Create, list, and organize conversation threads
- 💬 **Message Tracking** - Add messages from user or AI with timestamps
- 🎯 **Smart Filtering** - Filter by status (active, waiting, needs-reply, review, resolved, inbox)
- 📦 **Simple Storage** - Single JSONL file (`.threads.jsonl`) in your working directory
- 🎨 **Colored Output** - Easy-to-read colored status indicators
- 📊 **JSON Support** - All commands support `--json` for machine-readable output

## Installation

```bash
npm install -g @metyatech/thread-inbox
```

## Usage

### Create a new thread

```bash
thread-inbox new "Topics bulk assignment"
# Output: abc12345 (thread ID)

# With JSON output
thread-inbox new "Topics bulk assignment" --json
```

### List threads

```bash
# List all threads
thread-inbox list

# Filter by status
thread-inbox list --status active        # Open threads, no specific action pending
thread-inbox list --status waiting       # AI should respond (user sent a message)
thread-inbox list --status needs-reply   # User should reply (AI asked for input)
thread-inbox list --status review        # User should review (completion report, etc.)
thread-inbox list --status resolved      # Closed threads
thread-inbox list --status inbox         # needs-reply + review (all user-actionable)

# JSON output
thread-inbox list --json
```

Example output:

```
ID        STATUS       TITLE                          LAST MESSAGE        AGE
abc12345  needs-reply  Topics bulk assignment          "ok" (user, 5m)    2h
def67890  waiting      Auto-purge design              "Designing..." (ai) 1d
ghi11111  resolved     Pre-commit hook setup          "Done" (ai, 3d)     5d
```

### Show inbox (threads needing user action)

```bash
thread-inbox inbox
# Shows threads with status needs-reply or review
```

### Show thread details

```bash
thread-inbox show abc12345

# JSON output
thread-inbox show abc12345 --json
```

Example output:

```
Thread: Topics bulk assignment
ID: abc12345
Status: active
Created: 2026-02-23T00:00:00.000Z
Updated: 2026-02-23T02:05:00.000Z

Messages:
[ai] 2026-02-23T00:00:00.000Z
  Proposed 7 categories for GitHub Topics...

[user] 2026-02-23T02:05:00.000Z
  ok
```

### Add a message

```bash
# Add user message (default) — auto-sets status to "waiting"
thread-inbox add abc12345 "Looks good to me"

# Add AI message — does NOT change thread status (informational)
thread-inbox add abc12345 "Progress update..." --from ai

# Add AI message and request user reply
thread-inbox add abc12345 "Which approach do you prefer?" --from ai --status needs-reply

# Add AI message with completion report for review
thread-inbox add abc12345 "Task complete. Results: ..." --from ai --status review
```

### Resolve a thread

```bash
thread-inbox resolve abc12345
```

### Reopen a resolved thread

```bash
thread-inbox reopen abc12345
```

### Purge resolved threads

```bash
# Remove all resolved threads
thread-inbox purge

# Dry run (see what would be purged)
thread-inbox purge --dry-run
```

### Web GUI

```bash
# Launch the web GUI (opens browser automatically)
thread-inbox gui

# Specify port and data directory
thread-inbox gui --port 3334 --dir ~/projects/my-app
```

The GUI provides a browser-based interface for managing threads with status filtering, message history, and adding messages.

### Use a custom directory

All commands support `--dir <path>` to specify a working directory:

```bash
thread-inbox new "Test thread" --dir ~/projects/my-app
thread-inbox list --dir ~/projects/my-app
```

## Data Model

Threads are stored in a single JSONL file (`.threads.jsonl`) in the working directory.

Each line represents a thread:

```json
{
  "id": "abc12345",
  "title": "Topics bulk assignment",
  "status": "active",
  "messages": [
    {
      "sender": "ai",
      "content": "Proposed 7 categories for GitHub Topics...",
      "at": "2026-02-23T02:00:00.000Z"
    },
    {
      "sender": "user",
      "content": "ok",
      "at": "2026-02-23T02:05:00.000Z"
    }
  ],
  "createdAt": "2026-02-23T02:00:00.000Z",
  "updatedAt": "2026-02-23T02:05:00.000Z"
}
```

### Status Model

All statuses are explicit (stored directly, not computed from messages):

| Status        | Meaning                                    | Who should act |
| ------------- | ------------------------------------------ | -------------- |
| `active`      | Thread is open, no specific action pending | —              |
| `waiting`     | User sent a message/instruction            | AI             |
| `needs-reply` | AI asked for user input/decision           | User           |
| `review`      | AI reporting completion, needs user review | User           |
| `resolved`    | Thread is closed                           | —              |

**Status transitions:**

- `new` → `active`
- `add --from user` → auto-sets `waiting`
- `add --from ai` → no change (informational by default)
- `add --from ai --status needs-reply` → `needs-reply`
- `add --from ai --status review` → `review`
- `resolve` → `resolved`
- `reopen` → `active`

## Development

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

### Verify (format check + lint + build + test)

```bash
npm run verify
```

## License

MIT © metyatech
