import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildRenderJobs,
  getSlotCopy,
  layoutTextBox,
  loadProject,
  resolveTemplateForInstance
} from '../../core/src/index.ts';
import { createPlaywrightRenderer } from './playwrightRenderer.ts';
import { renderSceneWithFallback } from './fallbackPng.ts';

function ensureTemplateDefaults(template) {
  return {
    background: template.background || { type: 'solid', value: '#111827' },
    slotBackgrounds: template.slotBackgrounds || {},
    frame: template.frame || { enabled: true, type: 'simpleRounded', inset: 64, radius: 72 },
    text: template.text || {
      title: { x: 80, y: 120, w: 1000, h: 180, font: 'SF Pro', size: 72, weight: 700, align: 'left' },
      subtitle: { x: 80, y: 320, w: 1000, h: 140, font: 'SF Pro', size: 44, weight: 500, align: 'left' }
    },
    shotPlacement: template.shotPlacement || { x: 120, y: 560, w: 900, h: 1900, fit: 'cover', cornerRadius: 54 }
  };
}

function buildScene(projectContext, job) {
  const { doc, dir } = projectContext;
  const template = ensureTemplateDefaults(resolveTemplateForInstance(doc, job.device.id, job.locale));
  const background = {
    ...(template.background || {}),
    ...(template.slotBackgrounds?.[job.slot.id] || {})
  };
  const copy = getSlotCopy(doc, job.slot.id, job.locale);

  const titleBox = template.text?.title;
  const subtitleBox = template.text?.subtitle;

  const titleLayout = layoutTextBox(copy.title, titleBox.w, titleBox.h, titleBox.size, { ellipsis: true });
  const subtitleLayout = layoutTextBox(copy.subtitle, subtitleBox.w, subtitleBox.h, subtitleBox.size, { ellipsis: true });

  return {
    width: job.device.width,
    height: job.device.height,
    background,
    frame: template.frame,
    shotPlacement: template.shotPlacement,
    shotImagePath: path.resolve(dir, job.slot.sourceImagePath),
    text: {
      title: {
        ...titleBox,
        value: titleLayout.text,
        lines: titleLayout.lines,
        maxLines: titleLayout.maxLines,
        maxCharsPerLine: titleLayout.maxCharsPerLine
      },
      subtitle: {
        ...subtitleBox,
        value: subtitleLayout.text,
        lines: subtitleLayout.lines,
        maxLines: subtitleLayout.maxLines,
        maxCharsPerLine: subtitleLayout.maxCharsPerLine
      }
    },
    meta: {
      slotId: job.slot.id,
      locale: job.locale,
      deviceId: job.device.id,
      platform: job.platform
    }
  };
}

export async function renderProject(projectPath, options = {}) {
  const projectContext = await loadProject(projectPath);
  const jobs = buildRenderJobs(projectContext.doc);
  const outputDir = options.outputDir || path.join(projectContext.dir, 'dist');

  await fs.mkdir(outputDir, { recursive: true });

  const preferPlaywright = options.preferPlaywright !== false;
  const playwrightRenderer = preferPlaywright ? await createPlaywrightRenderer() : null;

  const outputs = [];
  for (const job of jobs) {
    const scene = buildScene(projectContext, job);
    const outPath = path.join(outputDir, job.platform, job.device.id, job.locale, `${job.slot.id}.png`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    if (playwrightRenderer) {
      await playwrightRenderer.render(scene, outPath);
      outputs.push(outPath);
      continue;
    }

    await renderSceneWithFallback(scene, outPath);
    outputs.push(outPath);
  }

  if (playwrightRenderer) {
    await playwrightRenderer.close();
  }

  return {
    count: outputs.length,
    outputs,
    engine: playwrightRenderer ? 'playwright' : 'fallback'
  };
}
