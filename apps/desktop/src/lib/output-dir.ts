const SERVICE_DIR_SUFFIX = "/Don't Mockup Again";
const LEGACY_DIR_SUFFIXES = ['/dont mockup again', '/Store Metadata Studio'];

export function deriveHomeDir(defaultExportDir: string): string {
  if (!defaultExportDir || !defaultExportDir.endsWith(SERVICE_DIR_SUFFIX)) {
    return '';
  }

  return defaultExportDir.slice(0, -SERVICE_DIR_SUFFIX.length);
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

    if (LEGACY_DIR_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
      normalized = `${homeDir}${SERVICE_DIR_SUFFIX}`;
    }
  }

  if (!normalized || normalized === 'dist') {
    return defaultExportDir || 'dist';
  }

  return normalized;
}
