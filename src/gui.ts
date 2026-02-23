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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getHtmlPath(): string {
  const candidates = [
    join(__dirname, 'public', 'index.html'),
    join(__dirname, '..', 'public', 'index.html'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('Could not find public/index.html. Make sure the public/ directory exists.');
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

function tryListen(server: Server, port: number, maxAttempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('error', onError);
      if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
        tryListen(server, port + 1, maxAttempts - 1).then(resolve, reject);
      } else {
        reject(err);
      }
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve(port);
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

export function startGui(dir: string, port = 3334): void {
  const resolvedDir = resolve(dir);

  const server = createServer((req: IncomingMessage, res: ServerResponse): void => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const method = req.method ?? 'GET';
      const pathname = url.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        // GET / — serve HTML
        if (pathname === '/' && method === 'GET') {
          const html = readFileSync(getHtmlPath(), 'utf-8');
          const injected = html.replace('__GUI_DIR__', JSON.stringify(resolvedDir));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(injected);
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

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } catch (err) {
        console.error('[gui] Request error:', err);
        sendError(res, 'Internal server error', 500);
      }
    })();
  });

  tryListen(server, port)
    .then((actualPort) => {
      const url = `http://localhost:${actualPort}`;
      console.log(`Thread Inbox GUI running at ${url}`);
      console.log(`Watching: ${resolvedDir}`);
      console.log('Press Ctrl+C to stop.');
      openBrowser(url);
    })
    .catch((err: Error) => {
      console.error('Failed to start GUI server:', err.message);
      process.exit(1);
    });
}
