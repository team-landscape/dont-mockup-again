import { renderTemplatePreviewBase64 } from '../components/preview/SlotPreview';
import { listPngFiles, readFileBase64, writeFileBase64 } from './desktop-runtime';
import {
  detectDevicePlatform,
  fieldKey,
  globalTemplateImageKey,
  imageMimeTypeFromPath,
  resolveTemplateElementsForSlot,
  slotTemplateImageKey,
  sortSlotsByOrder,
  type ProjectDoc,
  type TemplateMain
} from './project-model';

interface RenderExportImagesFromSnapshotArgs {
  snapshot: ProjectDoc;
  targetDir: string;
  templateImageUrls: Record<string, string>;
  runWithTimeout: <T>(promise: Promise<T>, timeoutMs: number, label: string) => Promise<T>;
  onProgress?: (detail: string) => void;
}

export async function renderExportImagesFromSnapshot({
  snapshot,
  targetDir,
  templateImageUrls,
  runWithTimeout,
  onProgress
}: RenderExportImagesFromSnapshotArgs) {
  const slots = sortSlotsByOrder(snapshot.project.slots || []);
  const locales = snapshot.project.locales || [];
  const platforms = snapshot.project.platforms || [];
  const devices = snapshot.project.devices || [];
  const templateMain = snapshot.template.main;
  const imageUrls = { ...templateImageUrls };

  const imageTargets: Array<{ key: string; path: string }> = [];
  for (const element of templateMain.elements) {
    if (element.kind !== 'image' || !element.imagePath) continue;
    imageTargets.push({ key: globalTemplateImageKey(element.id), path: element.imagePath });
  }
  for (const [slotId, elements] of Object.entries(templateMain.slotElements || {})) {
    for (const element of elements) {
      if (element.kind !== 'image' || !element.imagePath) continue;
      imageTargets.push({ key: slotTemplateImageKey(slotId, element.id), path: element.imagePath });
    }
  }

  for (const target of imageTargets) {
    if (imageUrls[target.key]) continue;
    try {
      const base64 = await readFileBase64(target.path);
      const mime = imageMimeTypeFromPath(target.path);
      imageUrls[target.key] = `data:${mime};base64,${base64}`;
    } catch {
      // Missing image path is allowed; renderer keeps placeholder.
    }
  }

  const total = Math.max(1, devices.length * locales.length * slots.length);
  let current = 0;

  for (const device of devices) {
    const platform = detectDevicePlatform(device, platforms);
    if (platforms.length > 0 && !platforms.includes(platform)) continue;

    for (const locale of locales) {
      for (const slot of slots) {
        current += 1;
        onProgress?.(`Rendering preview images... (${current}/${total})`);

        const title = snapshot.copy.keys[fieldKey(slot.id, 'title')]?.[locale] || '';
        const subtitle = snapshot.copy.keys[fieldKey(slot.id, 'subtitle')]?.[locale] || '';
        const template: TemplateMain = {
          ...templateMain,
          elements: resolveTemplateElementsForSlot(templateMain, slot.id),
          background: {
            ...templateMain.background,
            ...(templateMain.slotBackgrounds[slot.id] || {})
          }
        };
        const pngBase64 = await runWithTimeout(
          renderTemplatePreviewBase64({
            slotId: slot.id,
            title,
            subtitle,
            template,
            templateImageUrls: imageUrls,
            device
          }),
          20000,
          `preview render ${platform}/${device.id}/${locale}/${slot.id}`
        );

        const outPath = `${targetDir}/${platform}/${device.id}/${locale}/${slot.id}.png`;
        await writeFileBase64(outPath, pngBase64);
      }
    }
  }
}

export function collectExpectedRenderSuffixes(snapshot: ProjectDoc) {
  const suffixes: string[] = [];
  const slots = sortSlotsByOrder(snapshot.project.slots || []);
  const locales = snapshot.project.locales || [];
  const platforms = snapshot.project.platforms || [];
  const devices = snapshot.project.devices || [];

  for (const device of devices) {
    const platform = detectDevicePlatform(device, platforms);
    if (platforms.length > 0 && !platforms.includes(platform)) continue;
    for (const locale of locales) {
      for (const slot of slots) {
        suffixes.push(`${platform}/${device.id}/${locale}/${slot.id}.png`);
      }
    }
  }

  return suffixes;
}

export async function findMissingRenderedFiles(baseDir: string, expectedSuffixes: string[]) {
  const files = await listPngFiles(baseDir);
  const missing = expectedSuffixes.filter((suffix) => !files.some((entry) => entry.endsWith(suffix)));
  return { files, missing };
}
