import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  workspaceKey,
  sessionFilePath,
  queueFilePath,
  readSession,
  writeSession,
  readQueue,
  writeQueue,
  enqueueMessage,
  isPidAlive,
  buildClaudeArgs,
  buildClaudePrompt,
  parseClaudeOutput,
  isSessionInvalidError,
  resolveClaudeCommand,
  getBuiltinManagerStatus,
  startBuiltinManager,
  MANAGER_SESSION_FILE,
  MANAGER_QUEUE_FILE,
  MANAGER_MODEL,
  MANAGER_REPLY_STATUS,
} from '../manager-backend.js';

// ── Temp directory setup ───────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'thread-inbox-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ── workspaceKey ───────────────────────────────────────────────────────────

describe('workspaceKey', () => {
  it('returns a 16-char hex string', () => {
    const key = workspaceKey(tmpDir);
    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same directory', () => {
    expect(workspaceKey(tmpDir)).toBe(workspaceKey(tmpDir));
  });

  it('differs for different directories', () => {
    expect(workspaceKey('/path/a')).not.toBe(workspaceKey('/path/b'));
  });
});

// ── sessionFilePath / queueFilePath ───────────────────────────────────────

describe('sessionFilePath', () => {
  it('points to MANAGER_SESSION_FILE inside the workspace', () => {
    expect(sessionFilePath(tmpDir)).toContain(MANAGER_SESSION_FILE);
  });
});

describe('queueFilePath', () => {
  it('points to MANAGER_QUEUE_FILE inside the workspace', () => {
    expect(queueFilePath(tmpDir)).toContain(MANAGER_QUEUE_FILE);
  });
});

// ── readSession / writeSession ─────────────────────────────────────────────

describe('readSession', () => {
  it('returns a default not-started session when file is missing', async () => {
    const session = await readSession(tmpDir);
    expect(session.status).toBe('not-started');
    expect(session.sessionId).toBeNull();
    expect(session.pid).toBeNull();
    expect(session.workspaceKey).toBe(workspaceKey(tmpDir));
  });

  it('returns default session on corrupted JSON', async () => {
    const { writeFile } = await import('fs/promises');
    await writeFile(sessionFilePath(tmpDir), 'NOT_JSON', 'utf-8');
    const session = await readSession(tmpDir);
    expect(session.status).toBe('not-started');
  });
});

describe('writeSession / readSession round-trip', () => {
  it('persists and retrieves session data', async () => {
    const original = await readSession(tmpDir);
    const updated = { ...original, status: 'idle' as const, sessionId: 'sess-abc' };
    await writeSession(tmpDir, updated);
    const retrieved = await readSession(tmpDir);
    expect(retrieved.status).toBe('idle');
    expect(retrieved.sessionId).toBe('sess-abc');
  });
});

// ── readQueue / writeQueue ─────────────────────────────────────────────────

describe('readQueue', () => {
  it('returns empty array when file is missing', async () => {
    const queue = await readQueue(tmpDir);
    expect(queue).toEqual([]);
  });

  it('skips malformed lines', async () => {
    const { writeFile } = await import('fs/promises');
    await writeFile(
      queueFilePath(tmpDir),
      `NOT_JSON\n{"id":"q1","threadId":"t1","content":"msg","createdAt":"2026-01-01T00:00:00.000Z","processed":false}\n`,
      'utf-8',
    );
    const queue = await readQueue(tmpDir);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe('q1');
  });
});

describe('writeQueue / readQueue round-trip', () => {
  it('persists and retrieves queue entries', async () => {
    const entries = [
      {
        id: 'q1',
        threadId: 't1',
        content: 'hello',
        createdAt: '2026-01-01T00:00:00.000Z',
        processed: false,
      },
      {
        id: 'q2',
        threadId: 't2',
        content: 'world',
        createdAt: '2026-01-01T00:00:01.000Z',
        processed: true,
      },
    ];
    await writeQueue(tmpDir, entries);
    const retrieved = await readQueue(tmpDir);
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].id).toBe('q1');
    expect(retrieved[1].processed).toBe(true);
  });
});

// ── enqueueMessage ─────────────────────────────────────────────────────────

describe('enqueueMessage', () => {
  it('appends a new entry and returns an ID', async () => {
    const id = await enqueueMessage(tmpDir, 'thread1', 'Hello manager');
    expect(typeof id).toBe('string');
    expect(id.startsWith('q_')).toBe(true);
    const queue = await readQueue(tmpDir);
    expect(queue).toHaveLength(1);
    expect(queue[0].threadId).toBe('thread1');
    expect(queue[0].content).toBe('Hello manager');
    expect(queue[0].processed).toBe(false);
  });

  it('appends without overwriting existing entries', async () => {
    await enqueueMessage(tmpDir, 't1', 'first');
    await enqueueMessage(tmpDir, 't2', 'second');
    const queue = await readQueue(tmpDir);
    expect(queue).toHaveLength(2);
    expect(queue[0].content).toBe('first');
    expect(queue[1].content).toBe('second');
  });

  it('generates unique IDs for concurrent enqueues', async () => {
    const ids = await Promise.all([
      enqueueMessage(tmpDir, 't1', 'a'),
      enqueueMessage(tmpDir, 't1', 'b'),
      enqueueMessage(tmpDir, 't1', 'c'),
    ]);
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });
});

// ── isPidAlive ─────────────────────────────────────────────────────────────

describe('isPidAlive', () => {
  it('returns true for the current process PID', () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it('returns false for a PID that does not exist', () => {
    // PID 0 is always invalid for signal sending; on most OSes this returns EPERM or ESRCH
    // Use a very large PID that is almost certainly unused
    expect(isPidAlive(99999999)).toBe(false);
  });
});

// ── buildClaudeArgs ────────────────────────────────────────────────────────
// Regression test: --verbose is mandatory when combining -p with --output-format stream-json
// (Claude Code CLI: "When using --print, --output-format=stream-json requires --verbose")

describe('buildClaudeArgs', () => {
  it('includes --verbose flag (required for -p + stream-json)', () => {
    const args = buildClaudeArgs('hello', null);
    expect(args).toContain('--verbose');
  });

  it('includes -p, --output-format stream-json, and --model', () => {
    const args = buildClaudeArgs('hello', null);
    expect(args[0]).toBe('-p');
    expect(args[1]).toBe('hello');
    const fmtIdx = args.indexOf('--output-format');
    expect(fmtIdx).toBeGreaterThan(-1);
    expect(args[fmtIdx + 1]).toBe('stream-json');
    const modelIdx = args.indexOf('--model');
    expect(modelIdx).toBeGreaterThan(-1);
    expect(args[modelIdx + 1]).toBe(MANAGER_MODEL);
  });

  it('does not include --resume when sessionId is null', () => {
    const args = buildClaudeArgs('hello', null);
    expect(args).not.toContain('--resume');
  });

  it('includes --resume <sessionId> when sessionId is provided', () => {
    const args = buildClaudeArgs('hello', 'sess-123');
    const idx = args.indexOf('--resume');
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe('sess-123');
  });
});

// ── buildClaudePrompt ──────────────────────────────────────────────────────

describe('buildClaudePrompt', () => {
  it('includes system prompt on first turn', () => {
    const prompt = buildClaudePrompt('hello', 'tid', '/workspace', true);
    expect(prompt).toContain('manager AI assistant');
    expect(prompt).toContain('[Thread: tid]');
    expect(prompt).toContain('hello');
  });

  it('omits system prompt on subsequent turns', () => {
    const prompt = buildClaudePrompt('follow-up', 'tid', '/workspace', false);
    expect(prompt).not.toContain('manager AI assistant');
    expect(prompt).toContain('[Thread: tid]');
    expect(prompt).toContain('follow-up');
  });
});

// ── parseClaudeOutput ──────────────────────────────────────────────────────

describe('parseClaudeOutput', () => {
  it('extracts text and sessionId from stream-json result event', () => {
    const stdout = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: 'Here is the manager reply.',
      session_id: 'sess-xyz',
    });
    const { text, sessionId } = parseClaudeOutput(stdout);
    expect(text).toBe('Here is the manager reply.');
    expect(sessionId).toBe('sess-xyz');
  });

  it('extracts sessionId from system init event when no result event', () => {
    const line1 = JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess-abc' });
    const line2 = 'Plain text fallback line';
    const { text, sessionId } = parseClaudeOutput(`${line1}\n${line2}`);
    expect(sessionId).toBe('sess-abc');
    expect(text).toContain('Plain text fallback line');
  });

  it('returns sessionId null when no session ID is found', () => {
    const { sessionId } = parseClaudeOutput('plain text with no JSON');
    expect(sessionId).toBeNull();
  });

  it('returns plain text when output contains no JSON', () => {
    const { text } = parseClaudeOutput('This is plain text output.\nWith multiple lines.');
    expect(text).toContain('plain text');
  });

  it('prefers result event over plain text lines', () => {
    const plain = 'Some intermediate output';
    const result = JSON.stringify({ type: 'result', result: 'Final answer', session_id: 's1' });
    const { text } = parseClaudeOutput(`${plain}\n${result}`);
    expect(text).toBe('Final answer');
  });
});

// ── getBuiltinManagerStatus ────────────────────────────────────────────────

describe('getBuiltinManagerStatus', () => {
  it('returns not-started status when no session file exists', async () => {
    const status = await getBuiltinManagerStatus(tmpDir);
    expect(status.running).toBe(false);
    expect(status.configured).toBe(true);
    expect(status.builtinBackend).toBe(true);
    expect(status.detail).toMatch(/未起動/);
  });

  it('returns idle/running when status is idle', async () => {
    const session = await readSession(tmpDir);
    await writeSession(tmpDir, { ...session, status: 'idle' });
    const status = await getBuiltinManagerStatus(tmpDir);
    expect(status.running).toBe(true);
    expect(status.configured).toBe(true);
  });

  it('resets stale busy session (dead PID) to idle', async () => {
    const session = await readSession(tmpDir);
    // Use a PID that will never be alive: 99999999
    await writeSession(tmpDir, { ...session, status: 'busy', pid: 99999999 });
    const status = await getBuiltinManagerStatus(tmpDir);
    // After reset, should report as idle/running
    expect(status.running).toBe(true);
    const after = await readSession(tmpDir);
    expect(after.status).toBe('idle');
    expect(after.pid).toBeNull();
  });

  it('includes pending queue count in detail', async () => {
    const session = await readSession(tmpDir);
    await writeSession(tmpDir, { ...session, status: 'idle' });
    await enqueueMessage(tmpDir, 'tid', 'msg1');
    await enqueueMessage(tmpDir, 'tid', 'msg2');
    const status = await getBuiltinManagerStatus(tmpDir);
    expect(status.detail).toContain('2');
  });
});

// ── startBuiltinManager ────────────────────────────────────────────────────

describe('startBuiltinManager', () => {
  it('transitions status from not-started to idle', async () => {
    const result = await startBuiltinManager(tmpDir);
    expect(result.started).toBe(true);
    const session = await readSession(tmpDir);
    expect(session.status).toBe('idle');
    expect(session.startedAt).not.toBeNull();
  });

  it('does not reset an already-idle session', async () => {
    const session = await readSession(tmpDir);
    const customStartedAt = '2026-01-01T00:00:00.000Z';
    await writeSession(tmpDir, { ...session, status: 'idle', startedAt: customStartedAt });
    await startBuiltinManager(tmpDir);
    const after = await readSession(tmpDir);
    // startedAt should remain unchanged since status was already idle
    expect(after.startedAt).toBe(customStartedAt);
  });
});

// ── resolveClaudeCommand ────────────────────────────────────────────────────
// Regression: shell: true with spawn concatenates all args into a single command
// string; on Windows cmd.exe splits on whitespace, so a prompt like
// "Final runtime check. Reply briefly." is received by Claude as just "Final".
// The fix: always spawn 'claude' with shell: false (the default).  Node.js
// resolves the executable via OS PATHEXT/PATH on all platforms — whether the
// installation is claude.exe or a .cmd wrapper — without any shell-joining.

describe('resolveClaudeCommand', () => {
  it('returns "claude" on all platforms (shell: false + OS PATHEXT resolves the binary)', () => {
    expect(resolveClaudeCommand()).toBe('claude');
  });
});

// ── buildClaudeArgs prompt preservation ────────────────────────────────────
// Regression: the prompt (args[1]) must be passed as a single element in the
// args array so it is delivered to Claude intact — no splitting on whitespace.

describe('buildClaudeArgs prompt is a single element (Windows truncation regression)', () => {
  it('places the full prompt including spaces as args[1] — not split on whitespace', () => {
    const longPrompt = 'Final runtime check. Reply briefly.';
    const args = buildClaudeArgs(longPrompt, null);
    expect(args[0]).toBe('-p');
    // The entire prompt must be the single second element.
    // If this were split on spaces, args[1] would be only "Final".
    expect(args[1]).toBe(longPrompt);
  });

  it('preserves newlines and special characters in the prompt element', () => {
    const multilinePrompt = '[Thread: tid]\nHello manager, please help.';
    const args = buildClaudeArgs(multilinePrompt, null);
    expect(args[1]).toBe(multilinePrompt);
  });
});

// ── MANAGER_MODEL constant ─────────────────────────────────────────────────

describe('MANAGER_MODEL', () => {
  it('is claude-sonnet-4-6 per workspace rules', () => {
    expect(MANAGER_MODEL).toBe('claude-sonnet-4-6');
  });
});

// ── MANAGER_REPLY_STATUS constant ──────────────────────────────────────────
// Regression: successful manager replies must use 'active' so they land in
// the 返事が来ています bucket (status=active + last-sender=ai grouping rule).
// Using 'needs-reply' would misroute them to あなたの返答待ち.

describe('MANAGER_REPLY_STATUS', () => {
  it("is 'active' so replies land in 返事が来ています, not あなたの返答待ち", () => {
    expect(MANAGER_REPLY_STATUS).toBe('active');
  });
});

// ── Queue compaction ────────────────────────────────────────────────────────
// Regression: processed entries must be removed from the queue file so it does
// not grow unboundedly over time.

describe('queue compaction', () => {
  it('removes a processed entry, leaving only remaining entries', async () => {
    const id1 = await enqueueMessage(tmpDir, 't1', 'first');
    await enqueueMessage(tmpDir, 't2', 'second');

    let queue = await readQueue(tmpDir);
    expect(queue).toHaveLength(2);

    // Simulate finish handler: remove the processed entry by ID (no processed flag retained).
    await writeQueue(
      tmpDir,
      queue.filter((e) => e.id !== id1),
    );

    queue = await readQueue(tmpDir);
    expect(queue).toHaveLength(1);
    expect(queue[0].threadId).toBe('t2');
  });

  it('results in an empty queue after all entries are removed', async () => {
    const id1 = await enqueueMessage(tmpDir, 't1', 'a');
    const id2 = await enqueueMessage(tmpDir, 't1', 'b');

    await writeQueue(tmpDir, []);

    const queue = await readQueue(tmpDir);
    expect(queue).toHaveLength(0);

    // Keep TypeScript happy — IDs were used only to set up the scenario.
    void id1;
    void id2;
  });
});

// ── Concurrent enqueue safety ───────────────────────────────────────────────
// Regression: concurrent enqueueMessage calls must all land in the queue file
// without any entry being silently dropped due to write races.

describe('concurrent enqueue safety', () => {
  it('all concurrent enqueue calls appear in the queue file', async () => {
    const payloads = ['a', 'b', 'c', 'd', 'e'];
    await Promise.all(payloads.map((p) => enqueueMessage(tmpDir, 't1', p)));

    const queue = await readQueue(tmpDir);
    expect(queue).toHaveLength(payloads.length);

    const contents = queue.map((e) => e.content).sort();
    expect(contents).toEqual([...payloads].sort());
  });

  it('concurrent enqueue + writeQueue do not corrupt the file', async () => {
    // Pre-populate queue with one entry.
    const id1 = await enqueueMessage(tmpDir, 't1', 'pre-existing');

    // Concurrently: clear the queue (simulate finish) and add a new entry.
    // With serialisation, one runs completely before the other.
    const [, id2] = await Promise.all([
      writeQueue(tmpDir, []),
      enqueueMessage(tmpDir, 't2', 'concurrent'),
    ]);

    const queue = await readQueue(tmpDir);
    // The file must be valid JSONL — no corruption, no partial writes.
    expect(Array.isArray(queue)).toBe(true);
    for (const e of queue) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.content).toBe('string');
    }

    // Keep TypeScript happy.
    void id1;
    void id2;
  });
});

// ── isSessionInvalidError ───────────────────────────────────────────────────
// Regression: when Claude CLI stderr indicates a stale/invalid session,
// the backend must reset sessionId so the next call starts fresh.

describe('isSessionInvalidError', () => {
  it('detects "session not found" patterns', () => {
    expect(isSessionInvalidError('Error: session not found')).toBe(true);
    expect(isSessionInvalidError('Session not found for ID abc123')).toBe(true);
  });

  it('detects "session invalid" patterns', () => {
    expect(isSessionInvalidError('session invalid')).toBe(true);
    expect(isSessionInvalidError('Invalid session ID provided')).toBe(true);
  });

  it('detects "session expired" patterns', () => {
    expect(isSessionInvalidError('session expired')).toBe(true);
    expect(isSessionInvalidError('The session has expired')).toBe(true);
  });

  it('detects "session does not exist" patterns', () => {
    expect(isSessionInvalidError('session does not exist')).toBe(true);
  });

  it('detects "no such session" pattern', () => {
    expect(isSessionInvalidError('no such session')).toBe(true);
  });

  it('detects --resume error pattern', () => {
    expect(isSessionInvalidError('error: --resume flag failed')).toBe(true);
  });

  it('does not flag unrelated errors', () => {
    expect(isSessionInvalidError('command not found: claude')).toBe(false);
    expect(isSessionInvalidError('permission denied')).toBe(false);
    expect(isSessionInvalidError('')).toBe(false);
  });

  it('does not flag stderr that merely mentions session in a non-error context', () => {
    expect(isSessionInvalidError('Starting new session')).toBe(false);
  });
});
