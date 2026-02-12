export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function deepMerge(base, patch) {
  if (patch === null || patch === undefined) {
    return base;
  }

  if (Array.isArray(base) || Array.isArray(patch)) {
    return deepClone(patch);
  }

  if (typeof base !== 'object' || typeof patch !== 'object') {
    return patch;
  }

  const merged = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const current = merged[key];
    merged[key] = deepMerge(current, patchValue);
  }
  return merged;
}
