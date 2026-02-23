import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../../test-temp-cli');
const cliPath = path.join(__dirname, '../../dist/cli.js');

function runCli(
  args: string[],
  cwd: string = testDir,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [cliPath, ...args], { cwd });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });
  });
}

describe('CLI integration', () => {
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('new command', () => {
    it('should create a new thread', async () => {
      const { stdout, exitCode } = await runCli(['new', 'Test thread']);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/^[a-zA-Z0-9]{8}\n$/);
    });

    it('should support --json flag', async () => {
      const { stdout, exitCode } = await runCli(['new', 'Test thread', '--json']);

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(data.id).toBeDefined();
      expect(data.title).toBe('Test thread');
      expect(data.status).toBe('active');
    });
  });

  describe('list command', () => {
    it('should list all threads', async () => {
      await runCli(['new', 'Thread 1']);
      await runCli(['new', 'Thread 2']);

      const { stdout, exitCode } = await runCli(['list']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Thread 1');
      expect(stdout).toContain('Thread 2');
    });

    it('should filter by status', async () => {
      await runCli(['new', 'Active thread']);
      const { stdout: id2 } = await runCli(['new', 'Resolved thread']);
      await runCli(['resolve', id2.trim()]);

      const { stdout, exitCode } = await runCli(['list', '--status', 'active']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Active thread');
      expect(stdout).not.toContain('Resolved thread');
    });

    it('should support --json flag', async () => {
      await runCli(['new', 'Test thread']);

      const { stdout, exitCode } = await runCli(['list', '--json']);

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].title).toBe('Test thread');
    });
  });

  describe('inbox command', () => {
    it('should be alias for list --status needs-reply', async () => {
      const { stdout: id1 } = await runCli(['new', 'Thread 1']);
      await runCli(['add', id1.trim(), 'AI message', '--from', 'ai']);

      const { stdout: id2 } = await runCli(['new', 'Thread 2']);
      await runCli(['add', id2.trim(), 'User message']);

      const { stdout, exitCode } = await runCli(['inbox']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Thread 1');
      expect(stdout).not.toContain('Thread 2');
    });
  });

  describe('show command', () => {
    it('should show thread details', async () => {
      const { stdout: id } = await runCli(['new', 'Test thread']);
      await runCli(['add', id.trim(), 'Hello']);

      const { stdout, exitCode } = await runCli(['show', id.trim()]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Test thread');
      expect(stdout).toContain('Hello');
    });

    it('should support --json flag', async () => {
      const { stdout: id } = await runCli(['new', 'Test thread']);

      const { stdout, exitCode } = await runCli(['show', id.trim(), '--json']);

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(data.id).toBe(id.trim());
      expect(data.title).toBe('Test thread');
    });

    it('should error if thread not found', async () => {
      const { stderr, exitCode } = await runCli(['show', 'nonexistent']);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('not found');
    });
  });

  describe('add command', () => {
    it('should add message with default sender (user)', async () => {
      const { stdout: id } = await runCli(['new', 'Test thread']);
      const { exitCode } = await runCli(['add', id.trim(), 'Hello']);

      expect(exitCode).toBe(0);

      const { stdout } = await runCli(['show', id.trim(), '--json']);
      const data = JSON.parse(stdout);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].sender).toBe('user');
      expect(data.messages[0].content).toBe('Hello');
    });

    it('should add message with --from ai', async () => {
      const { stdout: id } = await runCli(['new', 'Test thread']);
      const { exitCode } = await runCli(['add', id.trim(), 'AI response', '--from', 'ai']);

      expect(exitCode).toBe(0);

      const { stdout } = await runCli(['show', id.trim(), '--json']);
      const data = JSON.parse(stdout);
      expect(data.messages[0].sender).toBe('ai');
    });

    it('should error if thread not found', async () => {
      const { stderr, exitCode } = await runCli(['add', 'nonexistent', 'Hello']);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('not found');
    });
  });

  describe('resolve command', () => {
    it('should mark thread as resolved', async () => {
      const { stdout: id } = await runCli(['new', 'Test thread']);
      const { exitCode } = await runCli(['resolve', id.trim()]);

      expect(exitCode).toBe(0);

      const { stdout } = await runCli(['show', id.trim(), '--json']);
      const data = JSON.parse(stdout);
      expect(data.status).toBe('resolved');
    });

    it('should error if thread not found', async () => {
      const { stderr, exitCode } = await runCli(['resolve', 'nonexistent']);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('not found');
    });
  });

  describe('reopen command', () => {
    it('should mark thread as active', async () => {
      const { stdout: id } = await runCli(['new', 'Test thread']);
      await runCli(['resolve', id.trim()]);
      const { exitCode } = await runCli(['reopen', id.trim()]);

      expect(exitCode).toBe(0);

      const { stdout } = await runCli(['show', id.trim(), '--json']);
      const data = JSON.parse(stdout);
      expect(data.status).toBe('active');
    });

    it('should error if thread not found', async () => {
      const { stderr, exitCode } = await runCli(['reopen', 'nonexistent']);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('not found');
    });
  });

  describe('purge command', () => {
    it('should remove all resolved threads', async () => {
      const { stdout: id1 } = await runCli(['new', 'Active thread']);
      const { stdout: id2 } = await runCli(['new', 'Resolved thread']);
      await runCli(['resolve', id2.trim()]);

      const { stdout, exitCode } = await runCli(['purge']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Purged 1 thread');

      const { stdout: list } = await runCli(['list', '--json']);
      const data = JSON.parse(list);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(id1.trim());
    });

    it('should support --dry-run flag', async () => {
      const { stdout: id } = await runCli(['new', 'Resolved thread']);
      await runCli(['resolve', id.trim()]);

      const { stdout, exitCode } = await runCli(['purge', '--dry-run']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Would purge 1 thread');

      const { stdout: list } = await runCli(['list', '--json']);
      const data = JSON.parse(list);
      expect(data).toHaveLength(1);
    });
  });

  describe('--dir flag', () => {
    it('should use custom directory', async () => {
      const customDir = path.join(testDir, 'custom');
      await fs.mkdir(customDir, { recursive: true });

      const { stdout: id } = await runCli(['new', 'Test thread', '--dir', customDir]);
      const { stdout, exitCode } = await runCli(['show', id.trim(), '--dir', customDir, '--json']);

      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(data.title).toBe('Test thread');
    });
  });
});
