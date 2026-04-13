import { randomUUID } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { Thread } from './types.js';

const FILENAME = '.threads.jsonl';
const LOCK_FILENAME = '.threads.lock';
const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_MS = 50;

function threadsFilePath(dir: string): string {
  return path.join(dir, FILENAME);
}

function threadsLockPath(dir: string): string {
  return path.join(dir, LOCK_FILENAME);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function clearStaleThreadsLock(lockPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs <= LOCK_STALE_MS) {
      return false;
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true;
    }
    throw error;
  }

  try {
    await fs.rm(lockPath);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true;
    }
    return false;
  }
}

async function acquireThreadsLock(dir: string): Promise<() => Promise<void>> {
  await fs.mkdir(dir, { recursive: true });

  const lockPath = threadsLockPath(dir);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
        }),
        'utf-8',
      );
      return async () => {
        await handle.close().catch(() => undefined);
        await fs.rm(lockPath, { force: true }).catch(() => undefined);
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      if (await clearStaleThreadsLock(lockPath)) {
        continue;
      }
      // No event-based wakeup exists for file locks here, so bounded polling is
      // the deterministic cross-process fallback.
      await sleep(LOCK_RETRY_MS);
    }
  }

  throw new Error(`Timed out waiting for thread storage lock in ${dir}`);
}

async function writeThreadsUnlocked(dir: string, threads: Thread[]): Promise<void> {
  const filePath = threadsFilePath(dir);
  const tempFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const content = threads.map((thread) => JSON.stringify(thread)).join('\n') + '\n';
  await fs.writeFile(tempFilePath, content, 'utf-8');
  await fs.rename(tempFilePath, filePath);
}

export async function readThreads(dir: string): Promise<Thread[]> {
  const filePath = threadsFilePath(dir);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as Thread;
        } catch {
          process.stderr.write(`Warning: skipping malformed line in ${filePath}: ${line}\n`);
          return null;
        }
      })
      .filter((thread): thread is Thread => thread !== null);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function writeThreads(dir: string, threads: Thread[]): Promise<void> {
  const release = await acquireThreadsLock(dir);
  try {
    await writeThreadsUnlocked(dir, threads);
  } finally {
    await release();
  }
}

export async function mutateThreads<T>(
  dir: string,
  updater: (threads: Thread[]) => Promise<T> | T,
): Promise<T> {
  const release = await acquireThreadsLock(dir);
  try {
    const threads = await readThreads(dir);
    const result = await updater(threads);
    await writeThreadsUnlocked(dir, threads);
    return result;
  } finally {
    await release();
  }
}
