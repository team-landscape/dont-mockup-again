import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { localizeProjectCopy } from '../packages/localization/src/index.ts';

async function withFakeGemini(run) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storeshot-llm-cli-'));
  const binDir = path.join(tempDir, 'bin');
  await fs.mkdir(binDir, { recursive: true });

  const geminiPath = path.join(binDir, 'gemini');
  await fs.writeFile(
    geminiPath,
    `#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const stdin = fs.readFileSync(0, 'utf8');

if (args.includes('--in')) {
  process.stderr.write('Unknown arguments: in, out, to\\n');
  process.exit(1);
}

if (args[0] !== '-p') {
  process.stderr.write('Expected -p mode\\n');
  process.exit(2);
}

const payload = JSON.parse(stdin || '{}');
const entries = {};
for (const [key, value] of Object.entries(payload.entries || {})) {
  entries[key] = String(value) + ' [' + payload.targetLocale + ']';
}

process.stdout.write(JSON.stringify({ entries }));
`,
    { mode: 0o755 }
  );

  const originalPath = process.env.PATH || '';
  process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;

  try {
    await run(tempDir);
  } finally {
    process.env.PATH = originalPath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function createDoc(argsTemplate) {
  return {
    project: {
      locales: ['en-US', 'ko-KR']
    },
    copy: {
      keys: {
        'slot1.title': { 'en-US': 'Clean in 5 minutes' },
        'slot1.subtitle': { 'en-US': 'Stay on track daily' }
      }
    },
    pipelines: {
      localization: {
        mode: 'llm-cli',
        sourceLocale: 'en-US',
        llmCli: {
          command: 'gemini',
          argsTemplate,
          timeoutSec: 10,
          promptVersion: 'v1',
          cachePath: '.cache/translation-cache.json'
        }
      }
    }
  };
}

test('llm-cli retries legacy gemini args with prompt mode', async () => {
  await withFakeGemini(async (projectDir) => {
    const doc = createDoc(['translate', '--in', '{INPUT}', '--out', '{OUTPUT}', '--to', '{LOCALE}']);
    const result = await localizeProjectCopy(doc, { projectDir });

    assert.equal(result.mode, 'llm-cli');
    assert.equal(result.byLocale['ko-KR'], 2);
    assert.equal(doc.copy.keys['slot1.title']['ko-KR'], 'Clean in 5 minutes [ko-KR]');
    assert.equal(doc.copy.keys['slot1.subtitle']['ko-KR'], 'Stay on track daily [ko-KR]');
  });
});

test('llm-cli uses prompt mode for gemini when argsTemplate is empty', async () => {
  await withFakeGemini(async (projectDir) => {
    const doc = createDoc([]);
    const result = await localizeProjectCopy(doc, { projectDir });

    assert.equal(result.mode, 'llm-cli');
    assert.equal(result.byLocale['ko-KR'], 2);
    assert.equal(doc.copy.keys['slot1.title']['ko-KR'], 'Clean in 5 minutes [ko-KR]');
  });
});
