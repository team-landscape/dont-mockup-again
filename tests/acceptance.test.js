import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { renderProject } from '../packages/renderer/src/index.ts';
import { loadProject, layoutTextBox, validateCopyCoverage } from '../packages/core/src/index.ts';
import { mergeByoyCopy, assertPlaceholdersPreserved, localizeProjectCopy } from '../packages/localization/src/index.ts';
import { exportProject } from '../packages/exporter/src/index.ts';

const rootDir = path.resolve('.');
const sampleProjectPath = path.join(rootDir, 'examples', 'sample.storeshot.json');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test('renders 12 outputs for 3 slots x 2 locales x 2 devices', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storeshot-render-'));
  const renderDir = path.join(tempDir, 'dist-render');

  const result = await renderProject(sampleProjectPath, {
    outputDir: renderDir,
    preferPlaywright: false
  });

  assert.equal(result.count, 12);
  assert.equal(result.outputs.length, 12);

  for (const output of result.outputs) {
    assert.equal(await exists(output), true);
  }
});

test('ko-KR long text stays inside box with wrap and ellipsis', () => {
  const longText = '하루 5분만 투자해도 루틴이 만들어지고 꾸준함이 성과로 이어지는 경험을 지금 바로 시작해 보세요';
  const layout = layoutTextBox(longText, 420, 120, 36, { ellipsis: true });

  assert.equal(layout.lines.length <= layout.maxLines, true);
  assert.equal(layout.lines.length > 0, true);
  assert.equal(layout.truncated, true);
  assert.equal(layout.text.includes('...'), true);
});

test('BYOY import detects missing keys/locales', async () => {
  const project = await loadProject(sampleProjectPath);
  const doc = JSON.parse(JSON.stringify(project.doc));
  doc.copy = { keys: {} };

  mergeByoyCopy(doc, {
    'slot1.title': { 'en-US': 'Clean in 5 minutes', 'ko-KR': '하루 5분이면 충분해요' },
    'slot1.subtitle': { 'en-US': 'Stay on track daily' }
  });

  const coverage = validateCopyCoverage(doc);

  assert.equal(coverage.ok, false);
  assert.equal(coverage.missing.some((item) => item.key === 'slot1.subtitle' && item.locale === 'ko-KR'), true);
  assert.equal(coverage.missing.some((item) => item.key === 'slot2.title' && item.locale === 'en-US'), true);
});

test('placeholder protection rejects broken translation', () => {
  assert.doesNotThrow(() => {
    assertPlaceholdersPreserved('Welcome {app_name} %@ {{count}}', '환영합니다 {app_name} %@ {{count}}', 'sample');
  });

  let failed = false;
  try {
    assertPlaceholdersPreserved('Welcome {app_name} %@', '환영합니다 app_name', 'broken');
  } catch (error) {
    failed = true;
    assert.equal(error.code, 'PLACEHOLDER_MISMATCH');
  }

  assert.equal(failed, true);
});

test('exporter creates zip output', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storeshot-export-'));
  const renderDir = path.join(tempDir, 'dist-render');
  const outDir = path.join(tempDir, 'dist');

  await renderProject(sampleProjectPath, {
    outputDir: renderDir,
    preferPlaywright: false
  });

  const result = await exportProject(sampleProjectPath, {
    renderDir,
    outputDir: outDir,
    zip: true,
    fastlaneLayout: true
  });

  assert.equal(await exists(outDir), true);
  assert.equal(await exists(result.zipPath), true);
});

test('localization engine maps legacy byoy mode to byok', async () => {
  const project = await loadProject(sampleProjectPath);
  const doc = JSON.parse(JSON.stringify(project.doc));
  doc.project.locales = ['en-US'];
  doc.pipelines = doc.pipelines || {};
  doc.pipelines.localization = {
    mode: 'byoy',
    sourceLocale: 'en-US'
  };

  const result = await localizeProjectCopy(doc, { projectDir: path.dirname(sampleProjectPath) });
  assert.equal(result.mode, 'byok');
  assert.equal(result.skipped, true);
});
