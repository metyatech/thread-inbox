import { describe, expect, it } from 'vitest';
import * as api from '../index.js';

describe('library entrypoint', () => {
  it('exports thread storage helpers for programmatic use', () => {
    expect(api.createThread).toBeTypeOf('function');
    expect(api.listThreads).toBeTypeOf('function');
    expect(api.getThread).toBeTypeOf('function');
    expect(api.addMessage).toBeTypeOf('function');
    expect(api.resolveThread).toBeTypeOf('function');
    expect(api.reopenThread).toBeTypeOf('function');
    expect(api.purgeThreads).toBeTypeOf('function');
  });
});
