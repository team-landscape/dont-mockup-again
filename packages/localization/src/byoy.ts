import fs from 'node:fs/promises';
import path from 'node:path';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeByoyCopy(projectDoc, byoyMapping) {
  if (!isObject(byoyMapping)) {
    throw new Error('BYOY mapping must be an object');
  }

  const target = projectDoc.copy?.keys ? projectDoc.copy.keys : {};

  let updated = 0;
  for (const [key, localeMap] of Object.entries(byoyMapping)) {
    if (!isObject(localeMap)) {
      continue;
    }

    target[key] = target[key] || {};

    for (const [locale, text] of Object.entries(localeMap)) {
      if (typeof text !== 'string') {
        continue;
      }

      target[key][locale] = text;
      updated += 1;
    }
  }

  projectDoc.copy = projectDoc.copy || {};
  projectDoc.copy.keys = target;

  return {
    updated,
    keys: Object.keys(byoyMapping).length
  };
}

export async function importByoyJson(projectDoc, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json') {
    throw new Error('MVP BYOY importer currently supports JSON only');
  }

  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  return mergeByoyCopy(projectDoc, parsed);
}
