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

### Manager GUI

```bash
# Launch the Manager GUI (opens browser automatically, default port 3335)
thread-inbox manager-gui

# Specify a working directory
thread-inbox manager-gui ./my-app

# Specify port
thread-inbox manager-gui --port 3336

# Bind to all interfaces for smartphone / remote access
thread-inbox manager-gui --host 0.0.0.0 --port 3335

# Bind to all interfaces and generate an access code for this run
thread-inbox manager-gui --host 0.0.0.0 --port 3335 --auth-token auto

# Start the server without opening a browser on the local machine
thread-inbox manager-gui --host 0.0.0.0 --no-open-browser
```

The Manager GUI is a single-screen workspace dashboard that shows all active threads and tasks at a glance.

#### Inbox section mapping

Five conversation sections group non-resolved threads using thread status and the sender of the last message. Each thread appears in exactly one section:

| Section label    | Grouping rule                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------- |
| 返事が来ています | `status === 'active'` **and** last message sender is `ai` — AI sent an informational update |
| あなたの返答待ち | `status === 'needs-reply'` — AI explicitly asked for user input                             |
| 確認待ちです     | `status === 'review'` — AI completed something; user should review it                       |
| 進んでいます     | `status === 'waiting'` — user sent instructions; AI is working                              |
| 止まっています   | `status === 'active'` **and** last message is from user (or no messages) — idle thread      |

Resolved threads are hidden from all sections.

A separate **タスク（進行中）** section below the five conversation sections shows active tasks from `.tasks.jsonl`. Tasks with stage `done`, `released`, or `committed` are hidden by default.

From the same screen you can:

- Create a new topic/thread (「+ 新しいトピック」button)
- Open and read any thread by clicking it
- Send a message to the manager from the thread detail (「🤖 マネージャーに送る」button, or `Ctrl+Enter`)
- Add a thread-only note without sending it to the manager (「メモを追加」button)
- Use quick-action buttons to mark a thread as `needs-reply` or `review` while replying
- **Create + send to Manager** (「🤖 作成してマネージャーに送る」) — creates the thread and immediately forwards the title to the manager
- Expand the **詳細** panel to send as AI or manually override thread status
- Resolve or reopen a thread from the detail header
- View active task-tracker tasks from `.tasks.jsonl`
- See manager lifecycle status and start the manager if it is stopped

#### Cross-device / smartphone access

By default the server listens on `127.0.0.1` (localhost only). To access the GUI from another device on the same network — for example a smartphone — bind to all interfaces:

```bash
thread-inbox manager-gui --host 0.0.0.0 --port 3335
```

Then open `http://<your-machine-ip>:3335` on the remote device. Replace `<your-machine-ip>` with the LAN IP of the machine running the server (e.g. `192.168.1.42`).

> **Security note**: Binding to `0.0.0.0` exposes the GUI on your local network. Use this only on trusted networks.

To protect the GUI when sharing it across devices, enable an access code:

```bash
# Use your own access code
thread-inbox manager-gui --host 0.0.0.0 --port 3335 --auth-token "my-shared-code"

# Or let thread-inbox generate one for this run and print it to the terminal
thread-inbox manager-gui --host 0.0.0.0 --port 3335 --auth-token auto
```

When an access code is configured, the browser shows an **アクセスコード** prompt before loading the inbox. The code is stored per workspace in browser local storage so the same device can reconnect without re-entering it every time.

If you are starting the GUI from another tool or over a remote session, use `--no-open-browser` to keep the server headless and avoid popping a local browser window.

#### Built-in manager backend

When no env-var override is configured, the Manager GUI uses a **built-in manager backend** that talks to Claude directly via the `claude` CLI.

**Requirements**: Claude Code CLI must be installed and available in `PATH`:

```bash
npm install -g @anthropic-ai/claude-code
```

**How it works**:

1. The first time you click **「🤖 マネージャーに送る」** (or create a thread with **「作成してマネージャーに送る」**), the message is added to a persistent queue and a `claude` process is spawned.
2. Claude replies are written back into the originating thread as AI messages with thread status `active`, so they appear in **返事が来ています** on the next refresh.
3. Follow-up messages resume the same Claude session via `--resume <session_id>`, maintaining conversation context across sends.
4. If a message arrives while the manager is already processing, it is queued and processed serially — no messages are dropped.
5. The model used is `claude-sonnet-4-6` (medium effort), per workspace rules.

**Workspace-local state files** (not committed to version control):

| File                         | Purpose                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `.thread-inbox-manager.json` | Session state: status (idle/busy/not-started), Claude session ID, process PID |
| `.thread-inbox-queue.jsonl`  | Persistent message queue; survives server restarts                            |

Add these to your `.gitignore`:

```
.thread-inbox-manager.json
.thread-inbox-queue.jsonl
```

**Status bar colours**:

- **Green** — manager is idle and ready
- **Amber** — manager is processing a message
- **Grey** — manager not yet started (auto-starts on first send)

#### Manager lifecycle adapter (env-var override)

To replace the built-in backend with an external manager process, set one or both of these environment variables:

| Variable                          | Purpose                                                                                                   | Example value                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `THREAD_INBOX_MANAGER_STATUS_CMD` | Command that exits `0` if manager is running, non-zero otherwise. `stdout` is shown as the status detail. | `pgrep -f "node manager"`             |
| `THREAD_INBOX_MANAGER_START_CMD`  | Command that starts the manager. Should return quickly (launch background process).                       | `nohup node manager.js &>/dev/null &` |

When either variable is set it takes precedence over the built-in backend for that operation. Setting only one variable is valid.

Example (bash):

```bash
export THREAD_INBOX_MANAGER_STATUS_CMD="pgrep -f manager-session"
export THREAD_INBOX_MANAGER_START_CMD="bash ~/scripts/start-manager.sh"
thread-inbox manager-gui ~/projects/my-app
```

> **Note**: The env-var path does not support the **「マネージャーに送る」** button — that always routes through the built-in backend.

#### Manager GUI access code

You can require an access code for all `manager-gui` API calls.

| Option / variable                | Purpose                                                                       | Example value     |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------- |
| `--auth-token <token>`           | Require the given access code.                                                | `shared-code-123` |
| `--auth-token auto`              | Generate a random access code for the current run and print it to stdout.     | `auto`            |
| `THREAD_INBOX_MANAGER_GUI_TOKEN` | Enable access-code protection via environment variable instead of CLI option. | `shared-code-123` |

Examples:

```bash
# Literal access code
thread-inbox manager-gui --host 0.0.0.0 --auth-token "shared-code-123"

# Generated access code
thread-inbox manager-gui --host 0.0.0.0 --auth-token auto

# Environment variable
export THREAD_INBOX_MANAGER_GUI_TOKEN="shared-code-123"
thread-inbox manager-gui --host 0.0.0.0
```

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

### Audit dependencies

```bash
npm run audit
```

### Format

```bash
npm run format
```

### Verify (format check + lint + build + test + audit)

```bash
npm run verify
```

## License

MIT © metyatech
