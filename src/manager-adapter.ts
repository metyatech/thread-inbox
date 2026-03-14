/**
 * Manager lifecycle adapter.
 *
 * Routing rules (in priority order):
 *  1. THREAD_INBOX_MANAGER_STATUS_CMD is set → env-var command takes precedence for status checks.
 *  2. THREAD_INBOX_MANAGER_START_CMD is set  → env-var command takes precedence for start.
 *  3. When a workspace `dir` is provided and no env-var applies → built-in backend.
 *  4. sendMessage() always routes to the built-in backend (env-var path does not support
 *     sending messages into a live conversation).
 *
 * Environment-variable overrides
 * ───────────────────────────────
 *   THREAD_INBOX_MANAGER_STATUS_CMD
 *     Shell command that exits 0 if the manager is running, non-zero otherwise.
 *     stdout is surfaced as the detail string.
 *     Example: "pgrep -f manager-session"
 *
 *   THREAD_INBOX_MANAGER_START_CMD
 *     Shell command that starts the manager.
 *     Should be non-blocking if you want the HTTP response to return promptly.
 *     Example: "nohup node manager.js &>/dev/null &"
 */

import { exec } from 'child_process';
import {
  getBuiltinManagerStatus,
  startBuiltinManager,
  sendToBuiltinManager,
} from './manager-backend.js';

export interface ManagerStatus {
  running: boolean;
  configured: boolean;
  /** true when the built-in backend is active (no env-var override in effect) */
  builtinBackend?: boolean;
  detail: string;
}

export interface ManagerStartResult {
  started: boolean;
  detail: string;
}

export interface SendMessageResult {
  queued: boolean;
  detail: string;
}

function runCommand(cmd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      resolve({
        code: error ? (error.code ?? 1) : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

/**
 * Get the manager status.
 * @param dir Workspace directory — required to use the built-in backend.
 */
export async function getManagerStatus(dir?: string): Promise<ManagerStatus> {
  const cmd = process.env['THREAD_INBOX_MANAGER_STATUS_CMD'];
  if (cmd) {
    const result = await runCommand(cmd);
    return {
      running: result.code === 0,
      configured: true,
      detail: result.stdout || (result.code === 0 ? 'Running' : result.stderr || 'Not running'),
    };
  }
  if (dir) {
    return getBuiltinManagerStatus(dir);
  }
  return {
    running: false,
    configured: false,
    detail: 'THREAD_INBOX_MANAGER_STATUS_CMD not configured',
  };
}

/**
 * Start the manager.
 * @param dir Workspace directory — required to use the built-in backend.
 */
export async function startManager(dir?: string): Promise<ManagerStartResult> {
  const cmd = process.env['THREAD_INBOX_MANAGER_START_CMD'];
  if (cmd) {
    const result = await runCommand(cmd);
    return {
      started: result.code === 0,
      detail: result.stdout || (result.code === 0 ? 'Started' : result.stderr || 'Failed to start'),
    };
  }
  if (dir) {
    return startBuiltinManager(dir);
  }
  return { started: false, detail: 'THREAD_INBOX_MANAGER_START_CMD not configured' };
}

/**
 * Send a message to the manager conversation for a given thread.
 * Always uses the built-in backend (env-var commands do not support this operation).
 */
export async function sendMessage(
  dir: string,
  threadId: string,
  content: string,
): Promise<SendMessageResult> {
  await sendToBuiltinManager(dir, threadId, content);
  return { queued: true, detail: 'メッセージをマネージャーキューに追加しました' };
}
