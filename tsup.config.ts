import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig([
  {
    // Node.js CLI
    entry: ['src/cli.ts'],
    format: ['esm'],
    target: 'node18',
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
    async onSuccess() {
      const destDir = join('dist', 'public');
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      const publicFiles = ['index.html'];
      for (const file of publicFiles) {
        const src = join('public', file);
        if (existsSync(src)) {
          copyFileSync(src, join(destDir, file));
        }
      }
    },
  },
  {
    // Library entry for programmatic access to thread storage APIs.
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    clean: false,
    dts: true,
  },
]);
