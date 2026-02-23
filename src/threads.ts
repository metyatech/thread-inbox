import { nanoid } from 'nanoid';
import { readThreads, writeThreads } from './storage.js';
import { Thread, ThreadFilters, ThreadStatus } from './types.js';

export async function createThread(dir: string, title: string): Promise<Thread> {
  const threads = await readThreads(dir);
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
  await writeThreads(dir, threads);

  return thread;
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
  const threads = await readThreads(dir);
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
  await writeThreads(dir, threads);

  return thread;
}

export async function resolveThread(dir: string, id: string): Promise<Thread> {
  const threads = await readThreads(dir);
  const threadIndex = threads.findIndex((t) => t.id === id);

  if (threadIndex === -1) {
    throw new Error('Thread not found');
  }

  const thread = threads[threadIndex];
  thread.status = 'resolved';
  thread.updatedAt = new Date().toISOString();

  threads[threadIndex] = thread;
  await writeThreads(dir, threads);

  return thread;
}

export async function reopenThread(dir: string, id: string): Promise<Thread> {
  const threads = await readThreads(dir);
  const threadIndex = threads.findIndex((t) => t.id === id);

  if (threadIndex === -1) {
    throw new Error('Thread not found');
  }

  const thread = threads[threadIndex];
  thread.status = 'active';
  thread.updatedAt = new Date().toISOString();

  threads[threadIndex] = thread;
  await writeThreads(dir, threads);

  return thread;
}

export async function purgeThreads(dir: string, dryRun = false): Promise<Thread[]> {
  const threads = await readThreads(dir);
  const resolvedThreads = threads.filter((t) => t.status === 'resolved');

  if (!dryRun && resolvedThreads.length > 0) {
    const remainingThreads = threads.filter((t) => t.status !== 'resolved');
    await writeThreads(dir, remainingThreads);
  }

  return resolvedThreads;
}
