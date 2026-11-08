import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  jsx: 'automatic',
  target: 'es2020',
  outfile: 'dist/app.js',
  define: { 'process.env.NODE_ENV': '"production"' },
});
console.log('Scolaris construit dans dist/');
