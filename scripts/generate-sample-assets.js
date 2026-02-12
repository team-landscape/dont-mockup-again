import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSceneWithFallback } from '../packages/renderer/src/fallbackPng.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(root, 'examples', 'assets', 'source');
await fs.mkdir(targetDir, { recursive: true });

const baseScene = {
  width: 1080,
  height: 1920,
  background: { type: 'gradient', from: '#1d4ed8', to: '#0f172a' },
  frame: { enabled: false },
  shotPlacement: { x: 120, y: 250, w: 840, h: 1420, cornerRadius: 40 },
  text: {
    title: { x: 140, y: 72, w: 800, h: 90, size: 56, lines: ['Sample'], maxLines: 1 },
    subtitle: { x: 140, y: 168, w: 800, h: 70, size: 34, lines: ['Preview'], maxLines: 1 }
  }
};

const variants = [
  { file: 'shot1.png', title: 'Habits', subtitle: 'Track daily wins', from: '#2563eb', to: '#0f172a' },
  { file: 'shot2.png', title: 'Focus', subtitle: 'Stay in rhythm', from: '#db2777', to: '#111827' },
  { file: 'shot3.png', title: 'Stats', subtitle: 'See your growth', from: '#f97316', to: '#7f1d1d' }
];

for (const variant of variants) {
  const scene = JSON.parse(JSON.stringify(baseScene));
  scene.background = { type: 'gradient', from: variant.from, to: variant.to };
  scene.text.title.lines = [variant.title];
  scene.text.subtitle.lines = [variant.subtitle];
  const outPath = path.join(targetDir, variant.file);
  await renderSceneWithFallback(scene, outPath);
}

console.log(`Generated ${variants.length} sample assets in ${targetDir}`);
