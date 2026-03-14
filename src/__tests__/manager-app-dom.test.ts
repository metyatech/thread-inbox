import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

interface TestMsg {
  sender: 'ai' | 'user';
  content: string;
  at: string;
}

interface TestThread {
  id: string;
  title: string;
  status: string;
  messages: TestMsg[];
  updatedAt: string;
  createdAt: string;
}

interface TestTask {
  id: string;
  stage?: string;
  description?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface ManagerStatus {
  running: boolean;
  configured: boolean;
  builtinBackend: boolean;
  detail?: string;
}

interface TestState {
  threads: TestThread[];
  tasks: TestTask[];
  managerStatus: ManagerStatus;
  requests: Array<{ url: string; headers: Headers }>;
  authToken?: string;
}

const managerHtml = readFileSync(join(process.cwd(), 'public', 'manager.html'), 'utf-8');

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installDom(options: { authRequired?: boolean; storageKey?: string } = {}): JSDOM {
  const dom = new JSDOM(managerHtml, { url: 'http://localhost/' });
  const windowWithGlobals = dom.window as typeof window & {
    GUI_DIR: string;
    MANAGER_AUTH_REQUIRED?: boolean;
    MANAGER_AUTH_STORAGE_KEY?: string;
  };
  windowWithGlobals.GUI_DIR = '/workspace';
  windowWithGlobals.MANAGER_AUTH_REQUIRED = options.authRequired ?? false;
  windowWithGlobals.MANAGER_AUTH_STORAGE_KEY =
    options.storageKey ?? 'thread-inbox.manager-token:test';

  Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });
  Object.defineProperty(dom.window, 'setInterval', {
    value: vi.fn(() => 1),
    configurable: true,
  });
  Object.defineProperty(dom.window, 'clearInterval', {
    value: vi.fn(),
    configurable: true,
  });

  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('navigator', dom.window.navigator);
  vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
  vi.stubGlobal('Element', dom.window.Element);
  vi.stubGlobal('Node', dom.window.Node);
  vi.stubGlobal('Event', dom.window.Event);
  vi.stubGlobal('MouseEvent', dom.window.MouseEvent);
  vi.stubGlobal('KeyboardEvent', dom.window.KeyboardEvent);
  vi.stubGlobal('HTMLInputElement', dom.window.HTMLInputElement);
  vi.stubGlobal('HTMLTextAreaElement', dom.window.HTMLTextAreaElement);
  vi.stubGlobal('HTMLButtonElement', dom.window.HTMLButtonElement);

  return dom;
}

function createFetchMock(state: TestState, authRequired = false) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    state.requests.push({ url, headers });

    if (authRequired && headers.get('X-Thread-Inbox-Token') !== state.authToken) {
      return jsonResponse({ authRequired: true }, 401);
    }

    if (url.includes('/api/threads?')) {
      return jsonResponse(state.threads);
    }
    if (url.includes('/api/tasks?')) {
      return jsonResponse(state.tasks);
    }
    if (url.endsWith('/api/manager/status')) {
      return jsonResponse(state.managerStatus);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

async function bootManagerApp(
  state: TestState,
  options: { authRequired?: boolean; storageKey?: string; awaitFetch?: boolean } = {},
): Promise<{ dom: JSDOM; fetchMock: ReturnType<typeof createFetchMock> }> {
  const dom = installDom(options);
  const fetchMock = createFetchMock(state, options.authRequired ?? false);
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  await import('../manager-app.ts');
  if (options.awaitFetch !== false) {
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  }
  return { dom, fetchMock };
}

async function waitForElement<T extends Element>(dom: JSDOM, selector: string): Promise<T> {
  let element: T | null = null;
  await vi.waitFor(() => {
    element = dom.window.document.querySelector<T>(selector);
    expect(element).not.toBeNull();
  });
  return element as T;
}

function makeThread(overrides: Partial<TestThread> = {}): TestThread {
  const now = overrides.updatedAt ?? '2026-03-14T00:00:00.000Z';
  return {
    id: overrides.id ?? 'thr-1',
    title: overrides.title ?? 'Android Billing',
    status: overrides.status ?? 'active',
    messages: overrides.messages ?? [
      {
        sender: 'ai',
        content: 'Initial reply',
        at: now,
      },
    ],
    createdAt: overrides.createdAt ?? now,
    updatedAt: now,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('manager-app DOM regressions', () => {
  it('reuses an existing thread row instead of replacing it on refresh', async () => {
    const state: TestState = {
      threads: [makeThread()],
      tasks: [],
      managerStatus: {
        running: true,
        configured: true,
        builtinBackend: true,
        detail: '待機中',
      },
      requests: [],
    };
    const { dom } = await bootManagerApp(state);

    const firstRow = await waitForElement<HTMLElement>(dom, '[data-thread-id="thr-1"]');

    state.threads = [
      makeThread({
        title: 'Android Billing follow-up',
        messages: [
          {
            sender: 'ai',
            content: 'Updated progress from manager',
            at: '2026-03-14T00:05:00.000Z',
          },
        ],
        updatedAt: '2026-03-14T00:05:00.000Z',
      }),
    ];

    dom.window.document
      .querySelector<HTMLElement>('[data-action="refresh"]')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      const preview = firstRow?.querySelector('[data-row-preview]')?.textContent ?? '';
      expect(preview).toContain('Updated progress from manager');
    });

    const refreshedRow = dom.window.document.querySelector<HTMLElement>('[data-thread-id="thr-1"]');
    expect(refreshedRow).toBe(firstRow);
    expect(firstRow?.querySelector('[data-row-title]')?.textContent).toContain('follow-up');
  });

  it('keeps the unsent draft textarea while patching the open detail thread', async () => {
    const state: TestState = {
      threads: [
        makeThread({
          status: 'active',
          messages: [
            {
              sender: 'user',
              content: 'Please keep digging',
              at: '2026-03-14T00:00:00.000Z',
            },
          ],
        }),
      ],
      tasks: [],
      managerStatus: {
        running: true,
        configured: true,
        builtinBackend: true,
        detail: '待機中',
      },
      requests: [],
    };
    const { dom } = await bootManagerApp(state);

    const row = await waitForElement<HTMLElement>(dom, '[data-thread-id="thr-1"]');
    row?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    const textarea = await waitForElement<HTMLTextAreaElement>(dom, '.reply-textarea');
    textarea.value = 'draft message that should survive refresh';

    state.threads = [
      makeThread({
        status: 'active',
        messages: [
          {
            sender: 'user',
            content: 'Please keep digging',
            at: '2026-03-14T00:00:00.000Z',
          },
          {
            sender: 'ai',
            content: 'Manager replied with new context',
            at: '2026-03-14T00:06:00.000Z',
          },
        ],
        updatedAt: '2026-03-14T00:06:00.000Z',
      }),
    ];

    dom.window.document
      .querySelector<HTMLElement>('[data-action="refresh"]')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      const bubbles = dom.window.document.querySelectorAll('.msg-area .bubble');
      expect(bubbles).toHaveLength(2);
      expect(bubbles[1]?.textContent).toContain('Manager replied with new context');
    });

    const refreshedTextarea =
      dom.window.document.querySelector<HTMLTextAreaElement>('.reply-textarea');
    expect(refreshedTextarea).toBe(textarea);
    expect(refreshedTextarea?.value).toBe('draft message that should survive refresh');
  });

  it('unlocks the auth gate in-browser and reuses the saved access code for API calls', async () => {
    const state: TestState = {
      threads: [makeThread()],
      tasks: [],
      managerStatus: {
        running: false,
        configured: true,
        builtinBackend: true,
        detail: '未起動',
      },
      requests: [],
      authToken: 'shared-code-123',
    };
    const { dom, fetchMock } = await bootManagerApp(state, {
      authRequired: true,
      storageKey: 'thread-inbox.manager-token:auth-test',
      awaitFetch: false,
    });

    const authPanel = dom.window.document.getElementById('auth-panel');
    expect(authPanel?.classList.contains('hidden')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    const input = dom.window.document.getElementById('auth-token-input') as HTMLInputElement;
    input.value = 'shared-code-123';
    dom.window.document
      .querySelector<HTMLElement>('[data-action="unlock-auth"]')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(authPanel?.classList.contains('hidden')).toBe(true);
    });

    expect(dom.window.localStorage.getItem('thread-inbox.manager-token:auth-test')).toBe(
      'shared-code-123',
    );

    const authorizedCalls = state.requests.filter((request) => request.url.includes('/api/'));
    expect(authorizedCalls.length).toBeGreaterThan(0);
    for (const request of authorizedCalls) {
      expect(request.headers.get('X-Thread-Inbox-Token')).toBe('shared-code-123');
    }
  });
});
