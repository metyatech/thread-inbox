import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readThreads, writeThreads } from '../storage.js';
import { Thread } from '../types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../../test-temp');
const testFile = path.join(testDir, '.threads.jsonl');

describe('storage', () => {
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('readThreads', () => {
    it('should return empty array when file does not exist', async () => {
      const threads = await readThreads(testDir);
      expect(threads).toEqual([]);
    });

    it('should read threads from JSONL file', async () => {
      const thread1: Thread = {
        id: 'abc123',
        title: 'Test thread',
        status: 'active',
        messages: [{ sender: 'ai', content: 'Hello', at: '2026-02-23T00:00:00.000Z' }],
        createdAt: '2026-02-23T00:00:00.000Z',
        updatedAt: '2026-02-23T00:00:00.000Z',
      };
      const thread2: Thread = {
        id: 'def456',
        title: 'Another thread',
        status: 'resolved',
        messages: [],
        createdAt: '2026-02-23T01:00:00.000Z',
        updatedAt: '2026-02-23T01:00:00.000Z',
      };

      await fs.writeFile(testFile, JSON.stringify(thread1) + '\n' + JSON.stringify(thread2) + '\n');

      const threads = await readThreads(testDir);
      expect(threads).toHaveLength(2);
      expect(threads[0]).toEqual(thread1);
      expect(threads[1]).toEqual(thread2);
    });

    it('should handle empty lines in JSONL file', async () => {
      const thread: Thread = {
        id: 'abc123',
        title: 'Test thread',
        status: 'active',
        messages: [],
        createdAt: '2026-02-23T00:00:00.000Z',
        updatedAt: '2026-02-23T00:00:00.000Z',
      };

      await fs.writeFile(testFile, '\n' + JSON.stringify(thread) + '\n\n');

      const threads = await readThreads(testDir);
      expect(threads).toHaveLength(1);
      expect(threads[0]).toEqual(thread);
    });
  });

  describe('writeThreads', () => {
    it('should write threads to JSONL file', async () => {
      const threads: Thread[] = [
        {
          id: 'abc123',
          title: 'Test thread',
          status: 'active',
          messages: [{ sender: 'user', content: 'Hi', at: '2026-02-23T00:00:00.000Z' }],
          createdAt: '2026-02-23T00:00:00.000Z',
          updatedAt: '2026-02-23T00:00:00.000Z',
        },
        {
          id: 'def456',
          title: 'Another thread',
          status: 'resolved',
          messages: [],
          createdAt: '2026-02-23T01:00:00.000Z',
          updatedAt: '2026-02-23T01:00:00.000Z',
        },
      ];

      await writeThreads(testDir, threads);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(threads[0]);
      expect(JSON.parse(lines[1])).toEqual(threads[1]);
    });

    it('should create directory if it does not exist', async () => {
      const nonExistentDir = path.join(testDir, 'nested', 'path');
      const threads: Thread[] = [
        {
          id: 'abc123',
          title: 'Test',
          status: 'active',
          messages: [],
          createdAt: '2026-02-23T00:00:00.000Z',
          updatedAt: '2026-02-23T00:00:00.000Z',
        },
      ];

      await writeThreads(nonExistentDir, threads);

      const content = await fs.readFile(path.join(nonExistentDir, '.threads.jsonl'), 'utf-8');
      expect(content.trim()).toBe(JSON.stringify(threads[0]));
    });

    it('should overwrite existing file atomically', async () => {
      const threads1: Thread[] = [
        {
          id: 'abc123',
          title: 'First',
          status: 'active',
          messages: [],
          createdAt: '2026-02-23T00:00:00.000Z',
          updatedAt: '2026-02-23T00:00:00.000Z',
        },
      ];
      const threads2: Thread[] = [
        {
          id: 'def456',
          title: 'Second',
          status: 'active',
          messages: [],
          createdAt: '2026-02-23T01:00:00.000Z',
          updatedAt: '2026-02-23T01:00:00.000Z',
        },
      ];

      await writeThreads(testDir, threads1);
      await writeThreads(testDir, threads2);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toEqual(threads2[0]);
    });
  });
});
