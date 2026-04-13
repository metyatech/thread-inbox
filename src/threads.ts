import { customAlphabet } from 'nanoid';
import { mutateThreads, readThreads } from './storage.js';
import { Thread, ThreadFilters, ThreadStatus } from './types.js';

// Use alphanumeric-only alphabet so IDs never start with '-' or '_',
// which would be misinterpreted as CLI option flags by commander.
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 8);

export async function createThread(dir: string, title: string): Promise<Thread> {
  return mutateThreads(dir, (threads) => {
    const now = new Date().toISOString();
    const thread: Thread = {
      id: nanoid(8),
      title,
      status: 'active',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    threads.push(thread);
    return thread;
  });
}

export async function listThreads(dir: string, filters?: ThreadFilters): Promise<Thread[]> {
  const threads = await readThreads(dir);

  if (!filters?.status) {
    return threads;
  }

  return threads.filter((thread) => {
    if (filters.status === 'inbox') {
      return thread.status === 'needs-reply' || thread.status === 'review';
    }

    return thread.status === filters.status;
  });
}

export async function getThread(dir: string, id: string): Promise<Thread | null> {
  const threads = await readThreads(dir);
  return threads.find((t) => t.id === id) || null;
}

export async function addMessage(
  dir: string,
  id: string,
  content: string,
  sender: 'ai' | 'user' = 'user',
  status?: ThreadStatus,
): Promise<Thread> {
  return mutateThreads(dir, (threads) => {
    const threadIndex = threads.findIndex((t) => t.id === id);

    if (threadIndex === -1) {
      throw new Error('Thread not found');
    }

    const thread = threads[threadIndex];
    thread.messages.push({
      sender,
      content,
      at: new Date().toISOString(),
    });
    thread.updatedAt = new Date().toISOString();

    if (status) {
      thread.status = status;
    } else if (sender === 'user') {
      thread.status = 'waiting';
    }

    threads[threadIndex] = thread;
    return thread;
  });
}

export async function resolveThread(dir: string, id: string): Promise<Thread> {
  return mutateThreads(dir, (threads) => {
    const threadIndex = threads.findIndex((t) => t.id === id);

    if (threadIndex === -1) {
      throw new Error('Thread not found');
    }

    const thread = threads[threadIndex];
    thread.status = 'resolved';
    thread.updatedAt = new Date().toISOString();

    threads[threadIndex] = thread;
    return thread;
  });
}

export async function reopenThread(dir: string, id: string): Promise<Thread> {
  return mutateThreads(dir, (threads) => {
    const threadIndex = threads.findIndex((t) => t.id === id);

    if (threadIndex === -1) {
      throw new Error('Thread not found');
    }

    const thread = threads[threadIndex];
    thread.status = 'active';
    thread.updatedAt = new Date().toISOString();

    threads[threadIndex] = thread;
    return thread;
  });
}

export async function purgeThreads(dir: string, dryRun = false): Promise<Thread[]> {
  if (dryRun) {
    const threads = await readThreads(dir);
    return threads.filter((t) => t.status === 'resolved');
  }

  return mutateThreads(dir, (threads) => {
    const resolvedThreads = threads.filter((t) => t.status === 'resolved');
    if (resolvedThreads.length === 0) {
      return [];
    }

    const remainingThreads = threads.filter((t) => t.status !== 'resolved');
    threads.splice(0, threads.length, ...remainingThreads);
    return resolvedThreads;
  });
}
