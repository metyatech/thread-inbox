import { describe, it, expect, afterEach } from 'vitest';
import { getManagerStatus, startManager } from '../manager-adapter.js';

const STATUS_VAR = 'THREAD_INBOX_MANAGER_STATUS_CMD';
const START_VAR = 'THREAD_INBOX_MANAGER_START_CMD';

afterEach(() => {
  delete process.env[STATUS_VAR];
  delete process.env[START_VAR];
});

describe('getManagerStatus', () => {
  it('returns not-configured when env var is not set', async () => {
    delete process.env[STATUS_VAR];
    const result = await getManagerStatus();
    expect(result.running).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.detail).toMatch(/not configured/i);
  });

  it('returns running=true when command exits 0', async () => {
    process.env[STATUS_VAR] = 'node -e "process.exit(0)"';
    const result = await getManagerStatus();
    expect(result.running).toBe(true);
    expect(result.configured).toBe(true);
  });

  it('returns running=false when command exits non-zero', async () => {
    process.env[STATUS_VAR] = 'node -e "process.exit(1)"';
    const result = await getManagerStatus();
    expect(result.running).toBe(false);
    expect(result.configured).toBe(true);
  });

  it('surfaces stdout as detail when command exits 0', async () => {
    process.env[STATUS_VAR] = 'node -e "process.stdout.write(\'manager ok\'); process.exit(0)"';
    const result = await getManagerStatus();
    expect(result.running).toBe(true);
    expect(result.detail).toBe('manager ok');
  });
});

describe('startManager', () => {
  it('returns not-configured when env var is not set', async () => {
    delete process.env[START_VAR];
    const result = await startManager();
    expect(result.started).toBe(false);
    expect(result.detail).toMatch(/not configured/i);
  });

  it('returns started=true when command exits 0', async () => {
    process.env[START_VAR] = 'node -e "process.exit(0)"';
    const result = await startManager();
    expect(result.started).toBe(true);
  });

  it('returns started=false when command exits non-zero', async () => {
    process.env[START_VAR] = 'node -e "process.exit(2)"';
    const result = await startManager();
    expect(result.started).toBe(false);
  });

  it('surfaces stdout as detail when command exits 0', async () => {
    process.env[START_VAR] = 'node -e "process.stdout.write(\'manager started\'); process.exit(0)"';
    const result = await startManager();
    expect(result.started).toBe(true);
    expect(result.detail).toBe('manager started');
  });
});
