export function requiredCopyKeysForSlots(slots) {
  const keys = [];
  for (const slot of slots || []) {
    keys.push(`${slot.id}.title`);
    keys.push(`${slot.id}.subtitle`);
  }
  return keys;
}

export function validateCopyCoverage(projectDoc) {
  const missing = [];
  const locales = projectDoc?.project?.locales || [];
  const keys = requiredCopyKeysForSlots(projectDoc?.project?.slots || []);
  const copyMap = projectDoc?.copy?.keys || {};

  for (const key of keys) {
    const localeMap = copyMap[key] || {};
    for (const locale of locales) {
      const text = localeMap[locale];
      if (typeof text !== 'string' || text.trim() === '') {
        missing.push({ key, locale });
      }
    }
  }

  return {
    ok: missing.length === 0,
    missing
  };
}
