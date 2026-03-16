import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '../../public/index.html');

describe('inspection GUI copy', () => {
  it('marks the browser UI as developer/admin inspection only', () => {
    const html = readFileSync(htmlPath, 'utf-8');

    expect(html).toContain('Thread Inbox Inspector');
    expect(html).toContain('Developer/admin inspection only');
    expect(html).toContain('Use Workspace Agent Hub for the normal Manager workflow.');
  });
});
