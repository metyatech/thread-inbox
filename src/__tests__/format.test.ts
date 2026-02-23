import { describe, it, expect } from 'vitest';
import { formatThreadList, formatThread, formatAge } from '../format.js';
import { Thread } from '../types.js';

describe('format', () => {
  describe('formatAge', () => {
    it('should format seconds', () => {
      const now = new Date('2026-02-23T00:00:30.000Z');
      const date = new Date('2026-02-23T00:00:00.000Z');
      expect(formatAge(date, now)).toBe('30s');
    });

    it('should format minutes', () => {
      const now = new Date('2026-02-23T00:05:00.000Z');
      const date = new Date('2026-02-23T00:00:00.000Z');
      expect(formatAge(date, now)).toBe('5m');
    });

    it('should format hours', () => {
      const now = new Date('2026-02-23T03:00:00.000Z');
      const date = new Date('2026-02-23T00:00:00.000Z');
      expect(formatAge(date, now)).toBe('3h');
    });

    it('should format days', () => {
      const now = new Date('2026-02-25T00:00:00.000Z');
      const date = new Date('2026-02-23T00:00:00.000Z');
      expect(formatAge(date, now)).toBe('2d');
    });

    it('should format weeks', () => {
      const now = new Date('2026-03-09T00:00:00.000Z');
      const date = new Date('2026-02-23T00:00:00.000Z');
      expect(formatAge(date, now)).toBe('2w');
    });

    it('should format months', () => {
      const now = new Date('2026-04-30T00:00:00.000Z');
      const date = new Date('2026-02-23T00:00:00.000Z');
      expect(formatAge(date, now)).toBe('2mo');
    });
  });

  describe('formatThreadList', () => {
    it('should format threads as table', () => {
      const threads: Thread[] = [
        {
          id: 'abc12345',
          title: 'Topics bulk assignment',
          status: 'active',
          messages: [
            { sender: 'ai', content: 'Proposed 7 categories', at: '2026-02-23T00:00:00.000Z' },
            { sender: 'user', content: 'ok', at: '2026-02-23T00:05:00.000Z' },
          ],
          createdAt: '2026-02-23T00:00:00.000Z',
          updatedAt: '2026-02-23T00:05:00.000Z',
        },
        {
          id: 'def67890',
          title: 'Auto-purge design',
          status: 'active',
          messages: [{ sender: 'ai', content: 'Designing...', at: '2026-02-22T00:00:00.000Z' }],
          createdAt: '2026-02-22T00:00:00.000Z',
          updatedAt: '2026-02-22T00:00:00.000Z',
        },
      ];

      const output = formatThreadList(threads, new Date('2026-02-23T02:00:00.000Z'));

      expect(output).toContain('ID');
      expect(output).toContain('STATUS');
      expect(output).toContain('TITLE');
      expect(output).toContain('LAST MESSAGE');
      expect(output).toContain('AGE');
      expect(output).toContain('abc12345');
      expect(output).toContain('Topics bulk assignment');
      expect(output).toContain('def67890');
      expect(output).toContain('Auto-purge design');
    });

    it('should handle empty list', () => {
      const output = formatThreadList([]);
      expect(output).toBe('No threads found.');
    });
  });

  describe('formatThread', () => {
    it('should format thread with messages', () => {
      const thread: Thread = {
        id: 'abc12345',
        title: 'Test thread',
        status: 'active',
        messages: [
          { sender: 'ai', content: 'Hello there', at: '2026-02-23T00:00:00.000Z' },
          { sender: 'user', content: 'Hi back', at: '2026-02-23T00:05:00.000Z' },
        ],
        createdAt: '2026-02-23T00:00:00.000Z',
        updatedAt: '2026-02-23T00:05:00.000Z',
      };

      const output = formatThread(thread);

      expect(output).toContain('Thread: Test thread');
      expect(output).toContain('ID: abc12345');
      expect(output).toContain('Status: active');
      expect(output).toContain('[ai]');
      expect(output).toContain('Hello there');
      expect(output).toContain('[user]');
      expect(output).toContain('Hi back');
    });

    it('should handle thread with no messages', () => {
      const thread: Thread = {
        id: 'abc12345',
        title: 'Empty thread',
        status: 'active',
        messages: [],
        createdAt: '2026-02-23T00:00:00.000Z',
        updatedAt: '2026-02-23T00:00:00.000Z',
      };

      const output = formatThread(thread);

      expect(output).toContain('Thread: Empty thread');
      expect(output).toContain('No messages yet.');
    });
  });
});
