import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import {
  listThreads,
  getThread,
  createThread,
  addMessage,
  resolveThread,
  reopenThread,
  purgeThreads,
} from './threads.js';
import { readActiveTasks } from './tasks.js';
import { getManagerStatus, startManager, sendMessage } from './manager-adapter.js';
import {
  isManagerGuiAuthorized,
  resolveManagerGuiAuthConfig,
  type ManagerGuiAuthConfig,
} from './manager-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getManagerHtmlCandidates(baseDir = __dirname): string[] {
  return [join(baseDir, 'public', 'manager.html'), join(baseDir, '..', 'public', 'manager.html')];
}

export function getManagerAppJsCandidates(baseDir = __dirname): string[] {
  return [
    join(baseDir, 'public', 'manager-app.js'),
    join(baseDir, '..', 'public', 'manager-app.js'),
    join(baseDir, '..', 'dist', 'public', 'manager-app.js'),
  ];
}

function getManagerHtmlPath(): string {
  for (const p of getManagerHtmlCandidates()) {
    if (existsSync(p)) return p;
  }
  throw new Error('Could not find public/manager.html. Make sure the public/ directory exists.');
}

function getManagerAppJsPath(): string {
  for (const p of getManagerAppJsCandidates()) {
    if (existsSync(p)) return p;
  }
  throw new Error('Could not find public/manager-app.js. Make sure the public/ directory exists.');
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, message: string, status = 400): void {
  sendJson(res, { error: message }, status);
}

function sendUnauthorized(res: ServerResponse): void {
  sendJson(
    res,
    {
      error: 'Access code required',
      authRequired: true,
    },
    401,
  );
}

function tryListen(server: Server, port: number, host: string, maxAttempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('error', onError);
      if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
        tryListen(server, port + 1, host, maxAttempts - 1).then(resolve, reject);
      } else {
        reject(err);
      }
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.removeListener('error', onError);
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve(actualPort);
    });
  });
}

function openBrowser(url: string): void {
  let cmd: string;
  if (process.platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Visit: ${url}`);
    }
  });
}

function injectManagerHtml(
  html: string,
  resolvedDir: string,
  authConfig: Pick<ManagerGuiAuthConfig, 'required' | 'storageKey'>,
): string {
  return html
    .replace('__GUI_DIR__', JSON.stringify(resolvedDir))
    .replace('__MANAGER_AUTH_REQUIRED__', authConfig.required ? 'true' : 'false')
    .replace('__MANAGER_AUTH_STORAGE_KEY__', JSON.stringify(authConfig.storageKey));
}

export interface StartManagerGuiOptions {
  port?: number;
  host?: string;
  authToken?: string;
  openBrowser?: boolean;
}

export async function createManagerGuiServer(
  dir: string,
  options: StartManagerGuiOptions = {},
): Promise<{
  server: Server;
  port: number;
  host: string;
  resolvedDir: string;
  authConfig: ManagerGuiAuthConfig;
}> {
  const resolvedDir = resolve(dir);
  const port = options.port ?? 3335;
  const host = options.host ?? '127.0.0.1';
  const authConfig = resolveManagerGuiAuthConfig(resolvedDir, options.authToken);

  const server = createServer((req: IncomingMessage, res: ServerResponse): void => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const method = req.method ?? 'GET';
      const pathname = url.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Thread-Inbox-Token',
      );

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        // GET / — serve manager HTML
        if (pathname === '/' && method === 'GET') {
          const html = readFileSync(getManagerHtmlPath(), 'utf-8');
          const injected = injectManagerHtml(html, resolvedDir, authConfig);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(injected);
          return;
        }

        // GET /manager-app.js — serve manager app JS module
        if (pathname === '/manager-app.js' && method === 'GET') {
          const js = readFileSync(getManagerAppJsPath(), 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(js);
          return;
        }

        if (pathname.startsWith('/api/') && !isManagerGuiAuthorized(req, authConfig)) {
          sendUnauthorized(res);
          return;
        }

        // GET /api/threads
        if (pathname === '/api/threads' && method === 'GET') {
          const queryDir = url.searchParams.get('dir') ?? resolvedDir;
          const threads = await listThreads(queryDir);
          sendJson(res, threads);
          return;
        }

        // POST /api/threads/purge — must come before /:id route
        if (pathname === '/api/threads/purge' && method === 'POST') {
          const body = await parseBody(req);
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          const purged = await purgeThreads(targetDir);
          sendJson(res, { count: purged.length, ids: purged.map((t) => t.id) });
          return;
        }

        // POST /api/threads
        if (pathname === '/api/threads' && method === 'POST') {
          const body = await parseBody(req);
          if (typeof body.title !== 'string' || !body.title) {
            sendError(res, 'title is required');
            return;
          }
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          const thread = await createThread(targetDir, body.title);
          sendJson(res, thread, 201);
          return;
        }

        // GET /api/threads/:id
        const threadIdMatch = pathname.match(/^\/api\/threads\/([^/]+)$/);
        if (threadIdMatch && method === 'GET') {
          const id = threadIdMatch[1];
          const queryDir = url.searchParams.get('dir') ?? resolvedDir;
          const thread = await getThread(queryDir, id);
          if (!thread) {
            sendError(res, 'Thread not found', 404);
            return;
          }
          sendJson(res, thread);
          return;
        }

        // POST /api/threads/:id/messages
        const messagesMatch = pathname.match(/^\/api\/threads\/([^/]+)\/messages$/);
        if (messagesMatch && method === 'POST') {
          const id = messagesMatch[1];
          const body = await parseBody(req);
          if (typeof body.content !== 'string' || !body.content) {
            sendError(res, 'content is required');
            return;
          }
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          const sender =
            body.from === 'ai' || body.from === 'user' ? (body.from as 'ai' | 'user') : 'user';
          const validStatuses = ['waiting', 'needs-reply', 'review', 'active', 'resolved'];
          const status =
            typeof body.status === 'string' && validStatuses.includes(body.status)
              ? (body.status as 'waiting' | 'needs-reply' | 'review' | 'active' | 'resolved')
              : undefined;
          const thread = await addMessage(targetDir, id, body.content, sender, status);
          sendJson(res, thread);
          return;
        }

        // PUT /api/threads/:id/resolve
        const resolveMatch = pathname.match(/^\/api\/threads\/([^/]+)\/resolve$/);
        if (resolveMatch && method === 'PUT') {
          const id = resolveMatch[1];
          const body = await parseBody(req);
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          const thread = await resolveThread(targetDir, id);
          sendJson(res, thread);
          return;
        }

        // PUT /api/threads/:id/reopen
        const reopenMatch = pathname.match(/^\/api\/threads\/([^/]+)\/reopen$/);
        if (reopenMatch && method === 'PUT') {
          const id = reopenMatch[1];
          const body = await parseBody(req);
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          const thread = await reopenThread(targetDir, id);
          sendJson(res, thread);
          return;
        }

        // GET /api/tasks
        if (pathname === '/api/tasks' && method === 'GET') {
          const queryDir = url.searchParams.get('dir') ?? resolvedDir;
          const tasks = await readActiveTasks(queryDir);
          sendJson(res, tasks);
          return;
        }

        // GET /api/manager/status
        if (pathname === '/api/manager/status' && method === 'GET') {
          const status = await getManagerStatus(resolvedDir);
          sendJson(res, status);
          return;
        }

        // POST /api/manager/start
        if (pathname === '/api/manager/start' && method === 'POST') {
          const result = await startManager(resolvedDir);
          sendJson(res, result, result.started ? 200 : 503);
          return;
        }

        // POST /api/manager/send — send a message to the manager conversation
        if (pathname === '/api/manager/send' && method === 'POST') {
          const body = await parseBody(req);
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          if (typeof body.threadId !== 'string' || !body.threadId) {
            sendError(res, 'threadId is required');
            return;
          }
          if (typeof body.content !== 'string' || !body.content) {
            sendError(res, 'content is required');
            return;
          }
          const result = await sendMessage(targetDir, body.threadId, body.content);
          sendJson(res, result);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } catch (err) {
        console.error('[manager-gui] Request error:', err);
        sendError(res, 'Internal server error', 500);
      }
    })();
  });

  const actualPort = await tryListen(server, port, host);
  return {
    server,
    port: actualPort,
    host,
    resolvedDir,
    authConfig,
  };
}

export function startManagerGui(dir: string, options: StartManagerGuiOptions = {}): void {
  createManagerGuiServer(dir, options)
    .then((actualPort) => {
      const displayHost = actualPort.host === '0.0.0.0' ? 'localhost' : actualPort.host;
      const url = `http://${displayHost}:${actualPort.port}`;
      console.log(`Manager GUI running at ${url}`);
      if (actualPort.host === '0.0.0.0') {
        console.log('Listening on all interfaces (network accessible).');
      }
      if (actualPort.authConfig.required) {
        if (actualPort.authConfig.source === 'generated') {
          console.log(`Access code: ${actualPort.authConfig.token}`);
        } else {
          console.log('Access code protection is enabled.');
        }
      } else if (actualPort.host !== '127.0.0.1' && actualPort.host !== 'localhost') {
        console.log('Warning: network access is enabled without an access code.');
      }
      console.log(`Watching: ${actualPort.resolvedDir}`);
      console.log('Press Ctrl+C to stop.');
      if (options.openBrowser !== false) {
        openBrowser(url);
      }
    })
    .catch((err: Error) => {
      console.error('Failed to start Manager GUI server:', err.message);
      process.exit(1);
    });
}
