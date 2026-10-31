import { cpSync } from 'node:fs';
import { defineConfig, type Options } from 'tsup';

const shared: Options = {
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  tsconfig: 'tsconfig.json',
  target: 'es2020',
  // The React entry shares the core's reader instead of bundling a second one.
  external: ['react', 'react/jsx-runtime', 'audio-reader-highlight'],
};

export default defineConfig([
  // The framework-free core: safe to import on a server or in a worker.
  { ...shared, entry: { index: 'src/index.ts' }, clean: true },
  {
    ...shared,
    entry: { react: 'src/react/index.ts' },
    banner: { js: "'use client';" },
    onSuccess: async () => {
      cpSync('src/styles.css', 'dist/styles.css');
      cpSync('src/data', 'dist/data', {
        recursive: true,
        filter: f => !f.endsWith('.ts'),
      });
    },
  },
]);
