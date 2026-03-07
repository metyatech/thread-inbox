/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import * as axeMatchers from 'vitest-axe/matchers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

expect.extend(axeMatchers);

describe('Web UI Accessibility', () => {
  it('should have no accessibility violations in index.html', async () => {
    const htmlPath = join(process.cwd(), 'public', 'index.html');
    const html = readFileSync(htmlPath, 'utf-8');

    // Inject a basic document into jsdom
    document.body.innerHTML = html;

    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
