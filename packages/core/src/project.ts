import fs from 'node:fs/promises';
import path from 'node:path';
import { deepClone, deepMerge } from './merge.ts';

export async function loadProject(projectPath) {
  const raw = await fs.readFile(projectPath, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    path: projectPath,
    dir: path.dirname(projectPath),
    doc: parsed
  };
}

export async function saveProject(projectPath, doc) {
  await fs.writeFile(projectPath, JSON.stringify(doc, null, 2));
}

export function detectDevicePlatform(device, projectPlatforms = []) {
  if (device.platform) {
    return device.platform;
  }

  if (device.id?.toLowerCase().includes('ios')) {
    return 'ios';
  }

  if (device.id?.toLowerCase().includes('android')) {
    return 'android';
  }

  return projectPlatforms[0] || 'ios';
}

function sortSlots(slots) {
  return [...(slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function buildRenderJobs(projectDoc) {
  const project = projectDoc.project || {};
  const platforms = project.platforms || [];
  const locales = project.locales || [];
  const devices = project.devices || [];
  const slots = sortSlots(project.slots || []);

  const jobs = [];
  for (const device of devices) {
    const platform = detectDevicePlatform(device, platforms);
    if (platforms.length > 0 && !platforms.includes(platform)) {
      continue;
    }

    for (const locale of locales) {
      for (const slot of slots) {
        jobs.push({
          platform,
          locale,
          device,
          slot
        });
      }
    }
  }

  return jobs;
}

function instanceMatches(instance, deviceId, locale) {
  const deviceMatch = !instance.deviceId || instance.deviceId === deviceId;
  const localeMatch = !instance.locale || instance.locale === locale;
  return deviceMatch && localeMatch;
}

export function resolveTemplateForInstance(projectDoc, deviceId, locale) {
  const template = projectDoc.template || {};
  const main = template.main || {};
  const instances = template.instances || [];

  const merged = deepClone(main);
  for (const instance of instances) {
    if (!instanceMatches(instance, deviceId, locale)) {
      continue;
    }

    if (instance.overrides) {
      Object.assign(merged, deepMerge(merged, instance.overrides));
    }
  }

  return merged;
}

export function getSlotCopy(projectDoc, slotId, locale, sourceLocale = 'en-US') {
  const keys = projectDoc.copy?.keys || {};
  const titleKey = `${slotId}.title`;
  const subtitleKey = `${slotId}.subtitle`;

  const titleLocaleMap = keys[titleKey] || {};
  const subtitleLocaleMap = keys[subtitleKey] || {};

  return {
    title: titleLocaleMap[locale] || titleLocaleMap[sourceLocale] || '',
    subtitle: subtitleLocaleMap[locale] || subtitleLocaleMap[sourceLocale] || ''
  };
}
