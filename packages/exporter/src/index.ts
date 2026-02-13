import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadProject } from '../../core/src/index.ts';

async function listFilesRecursive(baseDir) {
  const files = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  await walk(baseDir);
  return files;
}

async function copyRenderedAssets(renderDir, outputDir) {
  const files = await listFilesRecursive(renderDir);
  for (const filePath of files) {
    const relative = path.relative(renderDir, filePath);
    const target = path.join(outputDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(filePath, target);
  }
}

async function writeMetadata(projectDoc, outputDir) {
  const copyMap = projectDoc.copy?.keys || {};
  const locales = projectDoc.project?.locales || [];
  const platforms = projectDoc.project?.platforms || [];

  for (const platform of platforms) {
    for (const locale of locales) {
      const dir = path.join(outputDir, 'metadata', platform, locale);
      await fs.mkdir(dir, { recursive: true });

      for (const [key, localeMap] of Object.entries(copyMap)) {
        const value = localeMap[locale] || '';
        const fileSafe = key.replaceAll('.', '_');
        await fs.writeFile(path.join(dir, `${fileSafe}.txt`), value);
      }
    }
  }
}

function escapeCsvField(value) {
  const raw = String(value ?? '');
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

async function writeMetadataCsv(projectDoc, outputDir) {
  const copyMap = projectDoc.copy?.keys || {};
  const locales = projectDoc.project?.locales || [];
  const platforms = projectDoc.project?.platforms || [];
  const rows = ['platform,locale,key,value'];

  const keys = Object.keys(copyMap).sort();
  for (const platform of platforms) {
    for (const locale of locales) {
      for (const key of keys) {
        const value = copyMap[key]?.[locale] || '';
        rows.push([
          escapeCsvField(platform),
          escapeCsvField(locale),
          escapeCsvField(key),
          escapeCsvField(value)
        ].join(','));
      }
    }
  }

  const csvPath = path.join(outputDir, 'metadata.csv');
  await fs.writeFile(csvPath, `${rows.join('\n')}\n`, 'utf8');
  return csvPath;
}

async function writeFastlaneLayout(projectDoc, outputDir) {
  const platforms = projectDoc.project?.platforms || [];
  const locales = projectDoc.project?.locales || [];
  const copyMap = projectDoc.copy?.keys || {};

  if (platforms.includes('ios')) {
    for (const locale of locales) {
      const metaDir = path.join(outputDir, 'fastlane', 'metadata', locale);
      const shotsDir = path.join(outputDir, 'fastlane', 'screenshots', locale);
      await fs.mkdir(metaDir, { recursive: true });
      await fs.mkdir(shotsDir, { recursive: true });

      const title = copyMap['slot1.title']?.[locale] || '';
      const subtitle = copyMap['slot1.subtitle']?.[locale] || '';
      await fs.writeFile(path.join(metaDir, 'name.txt'), title);
      await fs.writeFile(path.join(metaDir, 'subtitle.txt'), subtitle);
      await fs.writeFile(path.join(metaDir, 'description.txt'), subtitle);

      const iosRendered = path.join(outputDir, 'ios');
      try {
        const files = await listFilesRecursive(iosRendered);
        for (const file of files.filter((item) => item.endsWith('.png') && item.includes(`/${locale}/`))) {
          const target = path.join(shotsDir, path.basename(file));
          await fs.copyFile(file, target);
        }
      } catch {
      }
    }
  }

  if (platforms.includes('android')) {
    for (const locale of locales) {
      const metaDir = path.join(outputDir, 'fastlane', 'metadata', locale);
      const shotsDir = path.join(metaDir, 'images', 'phoneScreenshots');
      await fs.mkdir(metaDir, { recursive: true });
      await fs.mkdir(shotsDir, { recursive: true });

      const title = copyMap['slot1.title']?.[locale] || '';
      const shortDesc = copyMap['slot1.subtitle']?.[locale] || '';
      const fullDesc = Object.entries(copyMap)
        .filter(([key]) => key.endsWith('.subtitle'))
        .map(([, localeMap]) => localeMap[locale] || '')
        .filter(Boolean)
        .join('\n');

      await fs.writeFile(path.join(metaDir, 'title.txt'), title);
      await fs.writeFile(path.join(metaDir, 'short_description.txt'), shortDesc);
      await fs.writeFile(path.join(metaDir, 'full_description.txt'), fullDesc);

      const androidRendered = path.join(outputDir, 'android');
      try {
        const files = await listFilesRecursive(androidRendered);
        for (const file of files.filter((item) => item.endsWith('.png') && item.includes(`/${locale}/`))) {
          const target = path.join(shotsDir, path.basename(file));
          await fs.copyFile(file, target);
        }
      } catch {
      }
    }
  }
}

async function zipDirectory(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('zip', ['-r', zipPath, '.'], {
      cwd: sourceDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`zip command failed: ${stderr.trim()}`));
        return;
      }
      resolve();
    });
  });
}

export async function exportProject(projectPath, options = {}) {
  const { doc } = await loadProject(projectPath);
  const renderDir = options.renderDir || path.join(path.dirname(projectPath), 'dist-render');
  const outputDir = options.outputDir || path.join(path.dirname(projectPath), 'dist');
  const zipEnabled = options.zip !== false;
  const fastlaneLayout = options.fastlaneLayout === true;
  const metadataCsvEnabled = options.metadataCsv === true;

  await fs.mkdir(outputDir, { recursive: true });
  await copyRenderedAssets(renderDir, outputDir);
  await writeMetadata(doc, outputDir);
  const metadataCsvPath = metadataCsvEnabled ? await writeMetadataCsv(doc, outputDir) : null;

  if (fastlaneLayout) {
    await writeFastlaneLayout(doc, outputDir);
  }

  let zipPath = null;
  if (zipEnabled) {
    zipPath = `${outputDir}.zip`;
    await fs.rm(zipPath, { force: true });
    await zipDirectory(outputDir, zipPath);
  }

  return {
    outputDir,
    zipPath,
    metadataCsvPath
  };
}
