const STORE_METADATA_SUFFIX = '/Store Metadata Studio';
const LEGACY_STORE_METADATA_SUFFIX = '/유저/Store Metadata Studio';

export function deriveHomeDir(defaultExportDir: string): string {
  if (!defaultExportDir || !defaultExportDir.endsWith(STORE_METADATA_SUFFIX)) {
    return '';
  }

  return defaultExportDir.slice(0, -STORE_METADATA_SUFFIX.length);
}

export function resolveOutputDir(value: string | undefined, defaultExportDir: string): string {
  let normalized = typeof value === 'string' ? value.trim() : '';
  const homeDir = deriveHomeDir(defaultExportDir);

  if (homeDir) {
    if (normalized === '~') {
      normalized = homeDir;
    } else if (normalized.startsWith('~/')) {
      normalized = `${homeDir}/${normalized.slice(2)}`;
    }

    if (normalized.endsWith(LEGACY_STORE_METADATA_SUFFIX)) {
      normalized = `${homeDir}${STORE_METADATA_SUFFIX}`;
    }
  }

  if (!normalized || normalized === 'dist') {
    return defaultExportDir || 'dist';
  }

  return normalized;
}
