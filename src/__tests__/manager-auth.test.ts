import { describe, it, expect, afterEach } from 'vitest';
import type { IncomingMessage } from 'node:http';
import {
  MANAGER_GUI_AUTH_ENV,
  buildManagerAuthStorageKey,
  extractManagerGuiToken,
  isManagerGuiAuthorized,
  resolveManagerGuiAuthConfig,
} from '../manager-auth.js';

afterEach(() => {
  delete process.env[MANAGER_GUI_AUTH_ENV];
});

function makeReq(headers: Record<string, string>): IncomingMessage {
  return {
    headers,
  } as IncomingMessage;
}

describe('resolveManagerGuiAuthConfig', () => {
  it('returns no auth when nothing is configured', () => {
    const config = resolveManagerGuiAuthConfig('/workspace');
    expect(config.required).toBe(false);
    expect(config.token).toBeNull();
    expect(config.source).toBe('none');
  });

  it('prefers explicit CLI token', () => {
    process.env[MANAGER_GUI_AUTH_ENV] = 'env-token';
    const config = resolveManagerGuiAuthConfig('/workspace', 'cli-token');
    expect(config.required).toBe(true);
    expect(config.token).toBe('cli-token');
    expect(config.source).toBe('cli');
  });

  it('uses env token when CLI token is absent', () => {
    process.env[MANAGER_GUI_AUTH_ENV] = 'env-token';
    const config = resolveManagerGuiAuthConfig('/workspace');
    expect(config.required).toBe(true);
    expect(config.token).toBe('env-token');
    expect(config.source).toBe('env');
  });

  it('generates a token when auto is requested', () => {
    const config = resolveManagerGuiAuthConfig('/workspace', 'auto');
    expect(config.required).toBe(true);
    expect(config.source).toBe('generated');
    expect(config.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(config.token?.length).toBeGreaterThan(10);
  });

  it('builds a storage key from the resolved workspace path', () => {
    expect(buildManagerAuthStorageKey('D:\\work')).toContain('thread-inbox.manager-token:');
  });
});

describe('manager auth headers', () => {
  it('extracts bearer token from Authorization header', () => {
    expect(extractManagerGuiToken(makeReq({ authorization: 'Bearer abc123' }))).toBe('abc123');
  });

  it('extracts token from X-Thread-Inbox-Token header', () => {
    expect(extractManagerGuiToken(makeReq({ 'x-thread-inbox-token': 'abc123' }))).toBe('abc123');
  });

  it('accepts matching token and rejects missing or mismatched ones', () => {
    const auth = { required: true, token: 'secret-token' };
    expect(isManagerGuiAuthorized(makeReq({ 'x-thread-inbox-token': 'secret-token' }), auth)).toBe(
      true,
    );
    expect(isManagerGuiAuthorized(makeReq({}), auth)).toBe(false);
    expect(isManagerGuiAuthorized(makeReq({ 'x-thread-inbox-token': 'wrong-token' }), auth)).toBe(
      false,
    );
  });
});
