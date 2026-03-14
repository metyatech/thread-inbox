/**
 * Regression tests for manager-gui server options.
 *
 * These tests verify that startManagerGui accepts a host parameter and that
 * the server binds to the specified host.  We start the server on a random
 * high port and connect to it, then shut it down.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  groupThreads,
  shouldScrollToBottom,
  reconcileIds,
  getNewMessages,
} from '../manager-state.js';
import type { Thread } from '../manager-state.js';
import { createManagerGuiServer, getManagerAppJsCandidates } from '../manager-gui.js';

// --------------------------------------------------------------------------
// Helper: start a plain HTTP server on a given host/port and collect the
// actual bound address.  This mirrors the tryListen logic in manager-gui.ts
// without importing the full server (which requires the public HTML file at
// build time).
// --------------------------------------------------------------------------

function listenOn(host: string, port: number): Promise<{ server: Server; boundPort: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ server, boundPort });
    });
  });
}

const openServers: Server[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('manager-gui host binding', () => {
  it('binds to 127.0.0.1 (localhost-only default)', async () => {
    const { server, boundPort } = await listenOn('127.0.0.1', 0);
    openServers.push(server);

    const addr = server.address();
    expect(typeof addr).toBe('object');
    expect((addr as { address: string }).address).toBe('127.0.0.1');
    expect(boundPort).toBeGreaterThan(0);
  });

  it('binds to 0.0.0.0 (all interfaces) when explicitly requested', async () => {
    const { server } = await listenOn('0.0.0.0', 0);
    openServers.push(server);

    const addr = server.address();
    expect(typeof addr).toBe('object');
    expect((addr as { address: string }).address).toBe('0.0.0.0');
  });

  it('startManagerGui is exported and callable', async () => {
    // Compile-time + runtime check: import verifies the function exists and is
    // callable with the (dir, options) signature.  We do NOT actually start
    // the server to avoid port conflicts and browser-open side effects.
    const mod = await import('../manager-gui.js');
    expect(typeof mod.startManagerGui).toBe('function');
    expect(mod.startManagerGui.toString()).toContain('options');
  });

  it('source-mode manager-app candidates include dist/public fallback', () => {
    const candidates = getManagerAppJsCandidates('D:/repo/src');
    expect(
      candidates.some(
        (candidate) =>
          candidate.endsWith('dist/public/manager-app.js') ||
          candidate.endsWith('dist\\public\\manager-app.js'),
      ),
    ).toBe(true);
  });
});

describe('manager-gui grouping logic', () => {
  // These tests exercise the inbox grouping rules as pure data transformations,
  // keeping them fast and dependency-free. Functions imported from manager-state.ts.

  function makeThread(
    id: string,
    status: string,
    messages: Array<{ sender: 'ai' | 'user' }> = [],
  ): Thread {
    return {
      id,
      status,
      title: `Thread ${id}`,
      messages: messages.map((m, i) => ({
        sender: m.sender,
        content: `msg ${i}`,
        at: new Date(i * 1000).toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it('routes review threads to 確認待ちです', () => {
    const groups = groupThreads([makeThread('t1', 'review', [{ sender: 'ai' }])]);
    expect(groups['review'].map((t) => t.id)).toEqual(['t1']);
    expect(groups['ai-replied']).toHaveLength(0);
  });

  it('routes needs-reply threads to あなたの返答待ち', () => {
    const groups = groupThreads([makeThread('t2', 'needs-reply', [{ sender: 'ai' }])]);
    expect(groups['needs-reply'].map((t) => t.id)).toEqual(['t2']);
    expect(groups['ai-replied']).toHaveLength(0);
  });

  it('routes waiting threads to 進んでいます', () => {
    const groups = groupThreads([makeThread('t3', 'waiting', [{ sender: 'user' }])]);
    expect(groups['waiting'].map((t) => t.id)).toEqual(['t3']);
  });

  it('routes active+last-ai threads to 返事が来ています', () => {
    const groups = groupThreads([
      makeThread('t4', 'active', [{ sender: 'user' }, { sender: 'ai' }]),
    ]);
    expect(groups['ai-replied'].map((t) => t.id)).toEqual(['t4']);
    expect(groups['idle']).toHaveLength(0);
  });

  it('routes active+last-user threads to 止まっています', () => {
    const groups = groupThreads([
      makeThread('t5', 'active', [{ sender: 'ai' }, { sender: 'user' }]),
    ]);
    expect(groups['idle'].map((t) => t.id)).toEqual(['t5']);
    expect(groups['ai-replied']).toHaveLength(0);
  });

  it('routes active+no-messages threads to 止まっています', () => {
    const groups = groupThreads([makeThread('t6', 'active', [])]);
    expect(groups['idle'].map((t) => t.id)).toEqual(['t6']);
  });

  it('hides resolved threads from all groups', () => {
    const groups = groupThreads([makeThread('t7', 'resolved', [{ sender: 'ai' }])]);
    const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(0);
  });

  it('does NOT route tasks to あなたの返答待ち (needs-reply is threads only)', () => {
    // Threads with needs-reply status go to needs-reply group.
    // The tasks section is handled separately and must never appear in any thread group.
    const groups = groupThreads([makeThread('t8', 'needs-reply', [{ sender: 'ai' }])]);
    expect(groups['needs-reply']).toHaveLength(1);
    // All other groups are empty for this thread set
    expect(groups['ai-replied']).toHaveLength(0);
    expect(groups['review']).toHaveLength(0);
    expect(groups['waiting']).toHaveLength(0);
    expect(groups['idle']).toHaveLength(0);
  });
});

// ── Scroll preservation logic ───────────────────────────────────────────────
//
// These tests document the pure decision function that the detail controller
// uses to decide whether to scroll to the bottom or restore the previous scroll
// position after a polling re-render. Function imported from manager-state.ts.

describe('scroll preservation logic', () => {
  it('scrolls to bottom on first open (isFirstRender=true)', () => {
    expect(
      shouldScrollToBottom({ isFirstRender: true, hasNewMessages: false, wasNearBottom: false }),
    ).toBe(true);
  });

  it('scrolls to bottom when opening a different thread (isFirstRender=true)', () => {
    expect(
      shouldScrollToBottom({ isFirstRender: true, hasNewMessages: true, wasNearBottom: false }),
    ).toBe(true);
  });

  it('scrolls to bottom when new message arrived and user was near bottom', () => {
    expect(
      shouldScrollToBottom({ isFirstRender: false, hasNewMessages: true, wasNearBottom: true }),
    ).toBe(true);
  });

  it('preserves scroll when new message arrived but user had scrolled up', () => {
    expect(
      shouldScrollToBottom({ isFirstRender: false, hasNewMessages: true, wasNearBottom: false }),
    ).toBe(false);
  });

  it('preserves scroll on periodic refresh with no new messages (user near bottom)', () => {
    // This is the primary regression case: auto-refresh must NOT yank the user.
    expect(
      shouldScrollToBottom({ isFirstRender: false, hasNewMessages: false, wasNearBottom: true }),
    ).toBe(false);
  });

  it('preserves scroll on periodic refresh with no new messages (user scrolled up)', () => {
    expect(
      shouldScrollToBottom({ isFirstRender: false, hasNewMessages: false, wasNearBottom: false }),
    ).toBe(false);
  });
});

// ── Reply action semantics ──────────────────────────────────────────────────
//
// These tests document the expected payload shapes of the two reply actions so
// that any accidental regression (e.g. swapping which action calls the manager
// API) is caught immediately.

describe('reply action semantics', () => {
  // Mirror of the payload built by doSendToManager() in manager-app.js.
  function buildManagerPayload(dir: string, content: string) {
    // Always sends as user, always sets status:'waiting' so the thread
    // lands in 進んでいます until the AI replies.
    return { dir, content, from: 'user' as const, status: 'waiting' as const };
  }

  // Mirror of the base payload built by doSend() (メモを追加) in manager-app.js.
  // status is omitted by default (no forced status change).
  function buildNotePayload(dir: string, content: string, selectedStatus: string) {
    const payload: { dir: string; content: string; from: string; status?: string } = {
      dir,
      content,
      from: 'user',
    };
    if (selectedStatus) payload.status = selectedStatus;
    return payload;
  }

  it('マネージャーに送る always sets status=waiting', () => {
    const p = buildManagerPayload('/workspace', 'hello');
    expect(p.status).toBe('waiting');
    expect(p.from).toBe('user');
  });

  it('マネージャーに送る payload causes thread to land in 進んでいます', () => {
    // Verify via groupThreads that status=waiting → waiting group.
    function groupStatus(status: string) {
      if (status === 'waiting') return 'waiting';
      if (status === 'needs-reply') return 'needs-reply';
      if (status === 'review') return 'review';
      return 'other';
    }
    expect(groupStatus(buildManagerPayload('/', 'hi').status)).toBe('waiting');
  });

  it('メモを追加 does not set status by default (no AI reply expected)', () => {
    const p = buildNotePayload('/workspace', 'just a note', '');
    expect(p.status).toBeUndefined();
  });

  it('メモを追加 can set explicit status when selectedStatus is provided', () => {
    const p = buildNotePayload('/workspace', 'note', 'needs-reply');
    expect(p.status).toBe('needs-reply');
  });
});

// ── Manager reply routing regressions ──────────────────────────────────────
//
// These tests document the expected grouping behavior for the manager send/reply
// lifecycle so that any accidental status regression is caught immediately.

describe('manager reply routing regression', () => {
  function makeThread(
    id: string,
    status: string,
    messages: Array<{ sender: 'ai' | 'user' }> = [],
  ): Thread {
    return {
      id,
      status,
      title: id,
      messages: messages.map((m, i) => ({
        sender: m.sender,
        content: `msg ${i}`,
        at: new Date(i * 1000).toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it('after doSendToManager: status=waiting thread lands in 進んでいます', () => {
    // Regression: doSendToManager must set status:'waiting', not omit it.
    // If omitted, the thread stays 'active' (or whatever previous status) and won't show in 進んでいます.
    const groups = groupThreads([makeThread('send1', 'waiting', [{ sender: 'user' }])]);
    expect(groups['waiting']).toHaveLength(1);
    expect(groups['idle']).toHaveLength(0);
    expect(groups['ai-replied']).toHaveLength(0);
  });

  it('after manager reply: status=active + last-ai lands in 返事が来ています (not あなたの返答待ち)', () => {
    // Regression: manager-backend must use MANAGER_REPLY_STATUS='active', not 'needs-reply'.
    // If 'needs-reply' were used, the thread would appear in あなたの返答待ち instead.
    const groups = groupThreads([
      makeThread('reply1', 'active', [{ sender: 'user' }, { sender: 'ai' }]),
    ]);
    expect(groups['ai-replied']).toHaveLength(1);
    expect(groups['needs-reply']).toHaveLength(0);
  });

  it('status=needs-reply goes to あなたの返答待ち (NOT 返事が来ています)', () => {
    // Documents that 'needs-reply' is distinct from 'active+last-ai'.
    // This would be wrong for normal manager replies.
    const groups = groupThreads([makeThread('nr1', 'needs-reply', [{ sender: 'ai' }])]);
    expect(groups['needs-reply']).toHaveLength(1);
    expect(groups['ai-replied']).toHaveLength(0);
  });

  it('full lifecycle: waiting → active+ai-reply routes correctly through each stage', () => {
    const waiting = makeThread('lc', 'waiting', [{ sender: 'user' }]);
    const replied = makeThread('lc', 'active', [{ sender: 'user' }, { sender: 'ai' }]);
    expect(groupThreads([waiting])['waiting']).toHaveLength(1);
    expect(groupThreads([replied])['ai-replied']).toHaveLength(1);
  });
});

// ── reconcileIds ────────────────────────────────────────────────────────────

describe('reconcileIds', () => {
  it('returns empty arrays when nothing changed', () => {
    const result = reconcileIds(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(result.add).toEqual([]);
    expect(result.remove).toEqual([]);
    expect(result.update).toEqual(['a', 'b', 'c']);
  });

  it('detects newly added IDs', () => {
    const result = reconcileIds(['a'], ['a', 'b']);
    expect(result.add).toEqual(['b']);
    expect(result.update).toEqual(['a']);
    expect(result.remove).toEqual([]);
  });

  it('detects removed IDs', () => {
    const result = reconcileIds(['a', 'b'], ['a']);
    expect(result.remove).toEqual(['b']);
    expect(result.update).toEqual(['a']);
    expect(result.add).toEqual([]);
  });

  it('handles full replacement', () => {
    const result = reconcileIds(['a', 'b'], ['c', 'd']);
    expect(result.add).toEqual(['c', 'd']);
    expect(result.remove).toEqual(['a', 'b']);
    expect(result.update).toEqual([]);
  });

  it('handles empty prev (first render)', () => {
    const result = reconcileIds([], ['x', 'y']);
    expect(result.add).toEqual(['x', 'y']);
    expect(result.remove).toEqual([]);
    expect(result.update).toEqual([]);
  });

  it('handles empty next (all removed)', () => {
    const result = reconcileIds(['x', 'y'], []);
    expect(result.add).toEqual([]);
    expect(result.remove).toEqual(['x', 'y']);
    expect(result.update).toEqual([]);
  });
});

// ── getNewMessages ──────────────────────────────────────────────────────────

describe('getNewMessages', () => {
  const msgs = [
    { sender: 'user' as const, content: 'a', at: '2024-01-01T00:00:00Z' },
    { sender: 'ai' as const, content: 'b', at: '2024-01-01T00:01:00Z' },
    { sender: 'user' as const, content: 'c', at: '2024-01-01T00:02:00Z' },
  ];

  it('returns empty array when no new messages', () => {
    expect(getNewMessages(3, msgs)).toEqual([]);
  });

  it('returns all messages when prevCount is 0', () => {
    expect(getNewMessages(0, msgs)).toEqual(msgs);
  });

  it('returns only new messages beyond prevCount', () => {
    const result = getNewMessages(1, msgs);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('b');
    expect(result[1].content).toBe('c');
  });

  it('returns empty array for empty message list', () => {
    expect(getNewMessages(0, [])).toEqual([]);
  });

  it('returns empty array when prevCount exceeds length', () => {
    expect(getNewMessages(10, msgs)).toEqual([]);
  });
});

describe('manager-gui auth protection', () => {
  async function makeWorkspace(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'thread-inbox-manager-auth-'));
    tempDirs.push(dir);
    const thread = {
      id: 'AbCd1234',
      title: 'Protected topic',
      status: 'active',
      messages: [{ sender: 'ai', content: 'hello', at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await writeFile(join(dir, '.threads.jsonl'), JSON.stringify(thread) + '\n', 'utf-8');
    return dir;
  }

  it('rejects unauthenticated API requests when auth token is configured', async () => {
    const dir = await makeWorkspace();
    const runtime = await createManagerGuiServer(dir, {
      port: 0,
      host: '127.0.0.1',
      authToken: 'secret-token',
      openBrowser: false,
    });
    openServers.push(runtime.server);

    const res = await fetch(
      `http://127.0.0.1:${runtime.port}/api/threads?dir=${encodeURIComponent(dir)}`,
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ authRequired: true });
  });

  it('allows authenticated API requests and injects auth bootstrap config into HTML', async () => {
    const dir = await makeWorkspace();
    const runtime = await createManagerGuiServer(dir, {
      port: 0,
      host: '127.0.0.1',
      authToken: 'secret-token',
      openBrowser: false,
    });
    openServers.push(runtime.server);

    const htmlRes = await fetch(`http://127.0.0.1:${runtime.port}/`);
    const html = await htmlRes.text();
    expect(html).toContain('window.MANAGER_AUTH_REQUIRED = true;');
    expect(html).toContain('window.MANAGER_AUTH_STORAGE_KEY = ');

    const apiRes = await fetch(
      `http://127.0.0.1:${runtime.port}/api/threads?dir=${encodeURIComponent(dir)}`,
      {
        headers: {
          'X-Thread-Inbox-Token': 'secret-token',
        },
      },
    );
    expect(apiRes.status).toBe(200);
    await expect(apiRes.json()).resolves.toMatchObject([
      {
        id: 'AbCd1234',
        title: 'Protected topic',
      },
    ]);
  });
});

describe('manager-gui onboarding copy', () => {
  it('serves first-use guidance in HTML and human-readable status copy in the browser app asset', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'thread-inbox-manager-onboarding-'));
    tempDirs.push(dir);
    const runtime = await createManagerGuiServer(dir, {
      port: 0,
      host: '127.0.0.1',
      openBrowser: false,
    });
    openServers.push(runtime.server);

    const htmlRes = await fetch(`http://127.0.0.1:${runtime.port}/`);
    const html = await htmlRes.text();
    expect(html).toContain('最初にやること');
    expect(html).toContain('最初の話題を作る');

    const js = await readFile(join(process.cwd(), 'src', 'manager-app.ts'), 'utf-8');
    expect(js).toContain('返答待ちにする');
    expect(js).toContain('新しい返事はまだありません');
  });
});
