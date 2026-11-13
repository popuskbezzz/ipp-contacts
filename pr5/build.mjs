import { build } from 'esbuild';

await build({
  entryPoints: ['pr5/client/app.ts'],
  outfile: 'pr5/public/app.js',
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2022',
  tsconfigRaw: { compilerOptions: { experimentalDecorators: true } }
});
