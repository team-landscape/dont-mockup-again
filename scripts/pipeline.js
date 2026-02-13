import path from 'node:path';
import { renderProject } from '../packages/renderer/src/index.ts';
import { validateProject, loadProject, saveProject } from '../packages/core/src/index.ts';
import { localizeProjectCopy } from '../packages/localization/src/index.ts';
import { exportProject } from '../packages/exporter/src/index.ts';
import { uploadWithFastlane } from '../packages/uploader/src/index.ts';

function usage() {
  console.log(`Usage:
  node scripts/pipeline.js render <projectPath> [renderDir]
  node scripts/pipeline.js localize <projectPath> [--write] [--source=<locale>] [--targets=<locale1,locale2>]
  node scripts/pipeline.js validate <projectPath>
  node scripts/pipeline.js export <projectPath> <renderDir> [outputDir] [--zip] [--fastlane] [--metadata-csv]
  node scripts/pipeline.js upload <exportDir> [iosLane] [androidLane]
  node scripts/pipeline.js all <projectPath> [workDir]`);
}

function parseValueFlag(flags, name) {
  const prefix = `${name}=`;
  const found = flags.find((flag) => flag.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function parseTargetLocales(raw) {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function run() {
  const [, , action, ...rest] = process.argv;

  if (!action) {
    usage();
    process.exit(1);
  }

  if (action === 'render') {
    const [projectPath, renderDir] = rest;
    if (!projectPath) {
      usage();
      process.exit(1);
    }

    const outputDir = renderDir || path.join(path.dirname(projectPath), 'dist-render');
    const result = await renderProject(projectPath, { outputDir, preferPlaywright: true });
    console.log(JSON.stringify({ action, ...result, outputDir }, null, 2));
    return;
  }

  if (action === 'validate') {
    const [projectPath] = rest;
    if (!projectPath) {
      usage();
      process.exit(1);
    }

    const { doc, dir } = await loadProject(projectPath);
    const result = await validateProject(doc, { projectDir: dir });
    console.log(JSON.stringify({ action, ...result }, null, 2));
    process.exit(result.ok ? 0 : 2);
    return;
  }

  if (action === 'localize') {
    const [projectPath, ...flags] = rest;
    if (!projectPath) {
      usage();
      process.exit(1);
    }

    const { doc, dir } = await loadProject(projectPath);
    const sourceLocale = parseValueFlag(flags, '--source');
    const targetLocales = parseTargetLocales(parseValueFlag(flags, '--targets'));
    const write = flags.includes('--write');

    const result = await localizeProjectCopy(doc, {
      projectDir: dir,
      sourceLocale: sourceLocale || undefined,
      targetLocales: targetLocales.length > 0 ? targetLocales : undefined
    });

    if (write) {
      await saveProject(projectPath, doc);
    }

    console.log(JSON.stringify({ action, write, ...result }, null, 2));
    return;
  }

  if (action === 'export') {
    const [projectPath, renderDir, outputDir, ...flags] = rest;
    if (!projectPath || !renderDir) {
      usage();
      process.exit(1);
    }

    const result = await exportProject(projectPath, {
      renderDir,
      outputDir,
      zip: flags.includes('--zip'),
      fastlaneLayout: flags.includes('--fastlane'),
      metadataCsv: flags.includes('--metadata-csv')
    });

    console.log(JSON.stringify({ action, ...result }, null, 2));
    return;
  }

  if (action === 'all') {
    const [projectPath, workDir] = rest;
    if (!projectPath) {
      usage();
      process.exit(1);
    }

    const base = workDir || path.join(path.dirname(projectPath), 'dist');
    const renderDir = `${base}-render`;
    const outputDir = base;

    const renderResult = await renderProject(projectPath, { outputDir: renderDir, preferPlaywright: true });
    const exportResult = await exportProject(projectPath, {
      renderDir,
      outputDir,
      zip: true,
      fastlaneLayout: false
    });

    console.log(JSON.stringify({ action, renderResult, exportResult }, null, 2));
    return;
  }

  if (action === 'upload') {
    const [exportDir, iosLane, androidLane] = rest;
    if (!exportDir || (!iosLane && !androidLane)) {
      usage();
      process.exit(1);
    }

    const result = await uploadWithFastlane({
      exportDir,
      uploadConfig: {
        iosLane,
        androidLane
      }
    });

    console.log(JSON.stringify({ action, platforms: result.map((item) => item.platform) }, null, 2));
    return;
  }

  usage();
  process.exit(1);
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
