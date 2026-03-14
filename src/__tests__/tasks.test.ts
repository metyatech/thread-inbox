import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readTasks, readActiveTasks } from '../tasks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../../test-temp-tasks');

const TASKS_FILE = path.join(testDir, '.tasks.jsonl');

function makeTask(overrides: Partial<{ id: string; description: string; stage: string }> = {}) {
  return {
    id: overrides.id ?? 'abc12345',
    description: overrides.description ?? 'Test task',
    stage: overrides.stage ?? 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function writeTasks(tasks: ReturnType<typeof makeTask>[]) {
  await fs.writeFile(TASKS_FILE, tasks.map((t) => JSON.stringify(t)).join('\n') + '\n', 'utf-8');
}

describe('tasks', () => {
  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('readTasks', () => {
    it('returns empty array when file does not exist', async () => {
      const tasks = await readTasks(testDir);
      expect(tasks).toEqual([]);
    });

    it('reads all tasks from file', async () => {
      await writeTasks([
        makeTask({ id: 'task1', stage: 'pending' }),
        makeTask({ id: 'task2', stage: 'done' }),
      ]);
      const tasks = await readTasks(testDir);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task1');
      expect(tasks[1].id).toBe('task2');
    });

    it('skips malformed JSON lines', async () => {
      await fs.writeFile(
        TASKS_FILE,
        `{"id":"ok","description":"good","stage":"pending"}\nnot-json\n{"id":"ok2","description":"also good","stage":"done"}\n`,
        'utf-8',
      );
      const tasks = await readTasks(testDir);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('ok');
      expect(tasks[1].id).toBe('ok2');
    });

    it('handles empty file gracefully', async () => {
      await fs.writeFile(TASKS_FILE, '', 'utf-8');
      const tasks = await readTasks(testDir);
      expect(tasks).toEqual([]);
    });
  });

  describe('readActiveTasks', () => {
    it('returns empty array when no tasks file exists', async () => {
      const tasks = await readActiveTasks(testDir);
      expect(tasks).toEqual([]);
    });

    it('filters out done tasks', async () => {
      await writeTasks([
        makeTask({ id: 'task1', stage: 'pending' }),
        makeTask({ id: 'task2', stage: 'done' }),
        makeTask({ id: 'task3', stage: 'in-progress' }),
        makeTask({ id: 'task4', stage: 'done' }),
      ]);
      const tasks = await readActiveTasks(testDir);
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.id).sort()).toEqual(['task1', 'task3'].sort());
    });

    it('returns all tasks when none are done', async () => {
      await writeTasks([
        makeTask({ id: 'task1', stage: 'pending' }),
        makeTask({ id: 'task2', stage: 'in-progress' }),
      ]);
      const tasks = await readActiveTasks(testDir);
      expect(tasks).toHaveLength(2);
    });

    it('returns empty array when all tasks are done', async () => {
      await writeTasks([
        makeTask({ id: 'task1', stage: 'done' }),
        makeTask({ id: 'task2', stage: 'done' }),
      ]);
      const tasks = await readActiveTasks(testDir);
      expect(tasks).toEqual([]);
    });

    it('filters out released tasks', async () => {
      await writeTasks([
        makeTask({ id: 'task1', stage: 'pending' }),
        makeTask({ id: 'task2', stage: 'released' }),
        makeTask({ id: 'task3', stage: 'in-progress' }),
      ]);
      const tasks = await readActiveTasks(testDir);
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.id).sort()).toEqual(['task1', 'task3'].sort());
    });

    it('filters out committed tasks', async () => {
      await writeTasks([
        makeTask({ id: 'task1', stage: 'pending' }),
        makeTask({ id: 'task2', stage: 'committed' }),
        makeTask({ id: 'task3', stage: 'committed' }),
      ]);
      const tasks = await readActiveTasks(testDir);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task1');
    });

    it('filters out done, released, and committed together', async () => {
      await writeTasks([
        makeTask({ id: 'keep1', stage: 'pending' }),
        makeTask({ id: 'keep2', stage: 'in-progress' }),
        makeTask({ id: 'drop1', stage: 'done' }),
        makeTask({ id: 'drop2', stage: 'released' }),
        makeTask({ id: 'drop3', stage: 'committed' }),
      ]);
      const tasks = await readActiveTasks(testDir);
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.id).sort()).toEqual(['keep1', 'keep2'].sort());
    });
  });
});
