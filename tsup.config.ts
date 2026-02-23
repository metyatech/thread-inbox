import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  async onSuccess() {
    const srcHtml = join('public', 'index.html');
    const destDir = join('dist', 'public');
    const destHtml = join(destDir, 'index.html');
    if (existsSync(srcHtml)) {
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(srcHtml, destHtml);
    }
  },
});
