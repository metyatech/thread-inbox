import type { IncomingMessage } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve as resolvePath } from 'node:path';

export const MANAGER_GUI_AUTH_ENV = 'THREAD_INBOX_MANAGER_GUI_TOKEN';

export interface ManagerGuiAuthConfig {
  token: string | null;
  required: boolean;
  storageKey: string;
  source: 'none' | 'cli' | 'env' | 'generated';
}

function normalizeToken(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function generateToken(): string {
  return randomBytes(18).toString('base64url');
}

export function buildManagerAuthStorageKey(dir: string): string {
  return `thread-inbox.manager-token:${resolvePath(dir)}`;
}

export function resolveManagerGuiAuthConfig(dir: string, cliToken?: string): ManagerGuiAuthConfig {
  const normalizedCliToken = normalizeToken(cliToken);
  if (normalizedCliToken === 'auto') {
    return {
      token: generateToken(),
      required: true,
      storageKey: buildManagerAuthStorageKey(dir),
      source: 'generated',
    };
  }

  if (normalizedCliToken) {
    return {
      token: normalizedCliToken,
      required: true,
      storageKey: buildManagerAuthStorageKey(dir),
      source: 'cli',
    };
  }

  const envToken = normalizeToken(process.env[MANAGER_GUI_AUTH_ENV]);
  if (envToken === 'auto') {
    return {
      token: generateToken(),
      required: true,
      storageKey: buildManagerAuthStorageKey(dir),
      source: 'generated',
    };
  }

  if (envToken) {
    return {
      token: envToken,
      required: true,
      storageKey: buildManagerAuthStorageKey(dir),
      source: 'env',
    };
  }

  return {
    token: null,
    required: false,
    storageKey: buildManagerAuthStorageKey(dir),
    source: 'none',
  };
}

export function extractManagerGuiToken(req: IncomingMessage): string | null {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return normalizeToken(authHeader.slice('Bearer '.length));
  }

  const tokenHeader = req.headers['x-thread-inbox-token'];
  if (typeof tokenHeader === 'string') {
    return normalizeToken(tokenHeader);
  }

  return null;
}

export function isManagerGuiAuthorized(
  req: IncomingMessage,
  authConfig: Pick<ManagerGuiAuthConfig, 'token' | 'required'>,
): boolean {
  if (!authConfig.required || !authConfig.token) {
    return true;
  }

  const provided = extractManagerGuiToken(req);
  if (!provided) {
    return false;
  }

  const expectedBytes = Buffer.from(authConfig.token, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, providedBytes);
}
