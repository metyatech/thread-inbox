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
      const publicFiles = ['index.html', 'manager.html'];
      for (const file of publicFiles) {
        const src = join('public', file);
        if (existsSync(src)) {
          copyFileSync(src, join(destDir, file));
        }
      }
    },
  },
  {
    // Browser app — emits dist/public/manager-app.js
    entry: { 'public/manager-app': 'src/manager-app.ts' },
    format: ['esm'],
    target: 'es2022',
    platform: 'browser',
    outDir: 'dist',
    clean: false,
    dts: false,
    minify: false,
  },
]);
