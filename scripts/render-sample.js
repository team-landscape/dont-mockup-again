import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderProject } from '../packages/renderer/src/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const projectPath = path.join(root, 'examples', 'sample.storeshot.json');
const outputDir = path.join(root, 'dist');

const result = await renderProject(projectPath, {
  outputDir,
  preferPlaywright: true
});

console.log(`Rendered ${result.count} image(s) to ${outputDir}`);
