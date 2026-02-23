import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createThread,
  listThreads,
  getThread,
  addMessage,
  resolveThread,
  reopenThread,
  purgeThreads,
} from '../threads.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../../test-temp-threads');

describe('threads', () => {
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createThread', () => {
    it('should create a new thread with generated ID', async () => {
      const thread = await createThread(testDir, 'Test thread');

      expect(thread.id).toBeDefined();
      expect(thread.id).toHaveLength(8);
      expect(thread.title).toBe('Test thread');
      expect(thread.status).toBe('active');
      expect(thread.messages).toEqual([]);
      expect(thread.createdAt).toBeDefined();
      expect(thread.updatedAt).toBe(thread.createdAt);
    });

    it('should persist thread to storage', async () => {
      const thread = await createThread(testDir, 'Test thread');
      const threads = await listThreads(testDir);

      expect(threads).toHaveLength(1);
      expect(threads[0]).toEqual(thread);
    });
  });

  describe('listThreads', () => {
    it('should return all threads when no filter', async () => {
      await createThread(testDir, 'Thread 1');
      await createThread(testDir, 'Thread 2');

      const threads = await listThreads(testDir);
      expect(threads).toHaveLength(2);
    });

    it('should filter by active status', async () => {
      const thread1 = await createThread(testDir, 'Active thread');
      const thread2 = await createThread(testDir, 'To resolve');
      await resolveThread(testDir, thread2.id);

      const threads = await listThreads(testDir, { status: 'active' });
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(thread1.id);
    });

    it('should filter by resolved status', async () => {
      await createThread(testDir, 'Active thread');
      const thread2 = await createThread(testDir, 'To resolve');
      await resolveThread(testDir, thread2.id);

      const threads = await listThreads(testDir, { status: 'resolved' });
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(thread2.id);
    });

    it('should filter by needs-reply (explicit status)', async () => {
      const thread1 = await createThread(testDir, 'Thread 1');
      await addMessage(testDir, thread1.id, 'AI question', 'ai', 'needs-reply');

      const thread2 = await createThread(testDir, 'Thread 2');
      await addMessage(testDir, thread2.id, 'AI update', 'ai');

      const thread3 = await createThread(testDir, 'Thread 3');
      await resolveThread(testDir, thread3.id);

      const threads = await listThreads(testDir, { status: 'needs-reply' });
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(thread1.id);
    });

    it('should filter by waiting (auto-set when user sends message)', async () => {
      const thread1 = await createThread(testDir, 'Thread 1');
      await addMessage(testDir, thread1.id, 'User message', 'user');

      const thread2 = await createThread(testDir, 'Thread 2');
      await addMessage(testDir, thread2.id, 'AI message', 'ai');

      const threads = await listThreads(testDir, { status: 'waiting' });
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(thread1.id);
    });

    it('should filter by review (explicit status)', async () => {
      const thread1 = await createThread(testDir, 'Thread 1');
      await addMessage(testDir, thread1.id, 'Completed', 'ai', 'review');

      const thread2 = await createThread(testDir, 'Thread 2');
      await addMessage(testDir, thread2.id, 'In progress', 'ai');

      const threads = await listThreads(testDir, { status: 'review' });
      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe(thread1.id);
    });

    it('should filter by inbox (needs-reply + review)', async () => {
      const thread1 = await createThread(testDir, 'Thread 1');
      await addMessage(testDir, thread1.id, 'Question', 'ai', 'needs-reply');

      const thread2 = await createThread(testDir, 'Thread 2');
      await addMessage(testDir, thread2.id, 'Done', 'ai', 'review');

      const thread3 = await createThread(testDir, 'Thread 3');
      await addMessage(testDir, thread3.id, 'Progress', 'ai');

      const threads = await listThreads(testDir, { status: 'inbox' });
      expect(threads).toHaveLength(2);
      const ids = threads.map((t) => t.id).sort();
      expect(ids).toEqual([thread1.id, thread2.id].sort());
    });
  });

  describe('getThread', () => {
    it('should return thread by ID', async () => {
      const thread = await createThread(testDir, 'Test thread');
      const retrieved = await getThread(testDir, thread.id);

      expect(retrieved).toEqual(thread);
    });

    it('should return null if thread not found', async () => {
      const retrieved = await getThread(testDir, 'nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('addMessage', () => {
    it('should add message with default sender (user) and set status to waiting', async () => {
      const thread = await createThread(testDir, 'Test thread');
      const updated = await addMessage(testDir, thread.id, 'Hello');

      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].sender).toBe('user');
      expect(updated.messages[0].content).toBe('Hello');
      expect(updated.messages[0].at).toBeDefined();
      expect(updated.status).toBe('waiting');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(thread.updatedAt).getTime(),
      );
    });

    it('should add AI message without changing status by default', async () => {
      const thread = await createThread(testDir, 'Test thread');
      const updated = await addMessage(testDir, thread.id, 'AI response', 'ai');

      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].sender).toBe('ai');
      expect(updated.messages[0].content).toBe('AI response');
      expect(updated.status).toBe('active');
    });

    it('should set explicit status when provided', async () => {
      const thread = await createThread(testDir, 'Test thread');
      const updated = await addMessage(testDir, thread.id, 'Need your input', 'ai', 'needs-reply');

      expect(updated.status).toBe('needs-reply');
    });

    it('should set review status when provided', async () => {
      const thread = await createThread(testDir, 'Test thread');
      const updated = await addMessage(testDir, thread.id, 'Task complete', 'ai', 'review');

      expect(updated.status).toBe('review');
    });

    it('should append to existing messages', async () => {
      const thread = await createThread(testDir, 'Test thread');
      await addMessage(testDir, thread.id, 'First message', 'user');
      const updated = await addMessage(testDir, thread.id, 'Second message', 'ai');

      expect(updated.messages).toHaveLength(2);
      expect(updated.messages[0].content).toBe('First message');
      expect(updated.messages[1].content).toBe('Second message');
    });

    it('should throw error if thread not found', async () => {
      await expect(addMessage(testDir, 'nonexistent', 'Hello')).rejects.toThrow('Thread not found');
    });
  });

  describe('resolveThread', () => {
    it('should mark thread as resolved', async () => {
      const thread = await createThread(testDir, 'Test thread');
      const updated = await resolveThread(testDir, thread.id);

      expect(updated.status).toBe('resolved');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(thread.updatedAt).getTime(),
      );
    });

    it('should throw error if thread not found', async () => {
      await expect(resolveThread(testDir, 'nonexistent')).rejects.toThrow('Thread not found');
    });
  });

  describe('reopenThread', () => {
    it('should mark thread as active', async () => {
      const thread = await createThread(testDir, 'Test thread');
      await resolveThread(testDir, thread.id);
      const updated = await reopenThread(testDir, thread.id);

      expect(updated.status).toBe('active');
    });

    it('should throw error if thread not found', async () => {
      await expect(reopenThread(testDir, 'nonexistent')).rejects.toThrow('Thread not found');
    });
  });

  describe('purgeThreads', () => {
    it('should remove all resolved threads', async () => {
      const thread1 = await createThread(testDir, 'Active thread');
      const thread2 = await createThread(testDir, 'Resolved thread 1');
      const thread3 = await createThread(testDir, 'Resolved thread 2');

      await resolveThread(testDir, thread2.id);
      await resolveThread(testDir, thread3.id);

      const purged = await purgeThreads(testDir);

      expect(purged).toHaveLength(2);
      expect(purged.map((t) => t.id).sort()).toEqual([thread2.id, thread3.id].sort());

      const remaining = await listThreads(testDir);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(thread1.id);
    });

    it('should return empty array if no resolved threads', async () => {
      await createThread(testDir, 'Active thread 1');
      await createThread(testDir, 'Active thread 2');

      const purged = await purgeThreads(testDir);
      expect(purged).toHaveLength(0);

      const remaining = await listThreads(testDir);
      expect(remaining).toHaveLength(2);
    });

    it('should handle dry run without removing threads', async () => {
      await createThread(testDir, 'Active thread');
      const thread2 = await createThread(testDir, 'Resolved thread');
      await resolveThread(testDir, thread2.id);

      const purged = await purgeThreads(testDir, true);

      expect(purged).toHaveLength(1);
      expect(purged[0].id).toBe(thread2.id);

      const remaining = await listThreads(testDir);
      expect(remaining).toHaveLength(2);
    });
  });
});
