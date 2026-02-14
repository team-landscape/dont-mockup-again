import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const resourcesDir = path.resolve(appRoot, 'src-tauri', 'resources');
const bundledNodePath = path.join(resourcesDir, 'bin', 'node');
const entryFile = path.resolve(repoRoot, 'scripts', 'pipeline.js');
const outFile = path.join(resourcesDir, 'pipeline.bundle.mjs');

await fs.mkdir(path.dirname(bundledNodePath), { recursive: true });
await fs.mkdir(path.dirname(outFile), { recursive: true });

await build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  legalComments: 'none',
  external: ['playwright']
});

await fs.copyFile(process.execPath, bundledNodePath);
await fs.chmod(bundledNodePath, 0o755);

console.log(`Bundled pipeline: ${outFile}`);
console.log(`Bundled node runtime: ${bundledNodePath}`);
