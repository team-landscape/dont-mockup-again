import fs from 'node:fs/promises';
import path from 'node:path';
import { translateWithByok } from './byok.ts';
import { translateWithCli } from './llmCli.ts';

function normalizeLocalizationMode(value) {
  if (value === 'llm-cli') {
    return 'llm-cli';
  }
  return 'byok';
}

function resolveSourceLocale(projectDoc, explicitSourceLocale) {
  const locales = projectDoc?.project?.locales || [];
  const preferred = explicitSourceLocale || projectDoc?.pipelines?.localization?.sourceLocale || locales[0];
  if (locales.includes(preferred)) {
    return preferred;
  }
  return locales[0] || 'en-US';
}

function resolveTargetLocales(projectDoc, sourceLocale, explicitTargetLocales) {
  const locales = projectDoc?.project?.locales || [];
  if (Array.isArray(explicitTargetLocales) && explicitTargetLocales.length > 0) {
    return [...new Set(explicitTargetLocales.filter((locale) => locale && locale !== sourceLocale))];
  }

  const configured = projectDoc?.pipelines?.localization?.targetLocales;
  if (Array.isArray(configured) && configured.length > 0) {
    return [...new Set(configured.filter((locale) => locale && locale !== sourceLocale))];
  }

  return locales.filter((locale) => locale !== sourceLocale);
}

function collectSourceEntries(projectDoc, sourceLocale) {
  const keys = projectDoc?.copy?.keys || {};
  const sourceEntries = {};
  for (const [key, localeMap] of Object.entries(keys)) {
    if (!localeMap || typeof localeMap !== 'object') {
      continue;
    }

    const sourceText = localeMap[sourceLocale];
    if (typeof sourceText === 'string' && sourceText.trim()) {
      sourceEntries[key] = sourceText;
    }
  }
  return sourceEntries;
}

function resolvePath(filePath, projectDir) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(projectDir, filePath);
}

async function readOptionalTextFile(filePath, projectDir) {
  const resolved = resolvePath(filePath, projectDir);
  if (!resolved) {
    return null;
  }

  try {
    const text = await fs.readFile(resolved, 'utf8');
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

function ensureCopyKeys(projectDoc) {
  projectDoc.copy = projectDoc.copy || {};
  projectDoc.copy.keys = projectDoc.copy.keys || {};
  return projectDoc.copy.keys;
}

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return Math.floor(parsed);
}

export async function localizeProjectCopy(projectDoc, options = {}) {
  const projectDir = options.projectDir || process.cwd();
  const localization = projectDoc?.pipelines?.localization || {};
  const mode = normalizeLocalizationMode(options.mode || localization.mode);
  const sourceLocale = resolveSourceLocale(projectDoc, options.sourceLocale);
  const targetLocales = resolveTargetLocales(projectDoc, sourceLocale, options.targetLocales);

  const sourceEntries = collectSourceEntries(projectDoc, sourceLocale);
  const sourceEntryCount = Object.keys(sourceEntries).length;
  if (sourceEntryCount === 0 || targetLocales.length === 0) {
    return {
      mode,
      sourceLocale,
      targetLocales,
      sourceEntryCount,
      localizedEntryCount: 0,
      byLocale: {},
      skipped: true
    };
  }

  const copyKeys = ensureCopyKeys(projectDoc);
  const byLocale = {};
  let localizedEntryCount = 0;

  const byokConfig = {
    baseUrl: 'https://api.openai.com/v1',
    endpointPath: '/chat/completions',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    timeoutSec: 120,
    promptVersion: 'v1',
    cachePath: '.storeshot/cache/translation-cache.json',
    ...(localization.byok || {})
  };

  const llmCliConfig = {
    command: 'gemini',
    argsTemplate: [],
    timeoutSec: 120,
    promptVersion: 'v1',
    cachePath: '.storeshot/cache/translation-cache.json',
    ...(localization.llmCli || {})
  };

  const byokStyleGuide = await readOptionalTextFile(byokConfig.styleGuidePath, projectDir);
  const llmStyleGuide = await readOptionalTextFile(llmCliConfig.styleGuidePath, projectDir);

  for (const targetLocale of targetLocales) {
    let translatedEntries = {};
    if (mode === 'llm-cli') {
      translatedEntries = await translateWithCli({
        command: llmCliConfig.command,
        argsTemplate: llmCliConfig.argsTemplate,
        sourceLocale,
        targetLocale,
        entries: sourceEntries,
        promptVersion: llmCliConfig.promptVersion,
        styleGuide: llmStyleGuide,
        timeoutSec: parsePositiveInt(llmCliConfig.timeoutSec, 120),
        cachePath: resolvePath(llmCliConfig.cachePath, projectDir),
        cwd: projectDir
      });
    } else {
      translatedEntries = await translateWithByok({
        baseUrl: byokConfig.baseUrl,
        endpointPath: byokConfig.endpointPath,
        model: byokConfig.model,
        apiKeyEnv: byokConfig.apiKeyEnv,
        sourceLocale,
        targetLocale,
        entries: sourceEntries,
        promptVersion: byokConfig.promptVersion,
        styleGuide: byokStyleGuide,
        timeoutSec: parsePositiveInt(byokConfig.timeoutSec, 120),
        cachePath: resolvePath(byokConfig.cachePath, projectDir)
      });
    }

    let localeUpdates = 0;
    for (const [key, translatedText] of Object.entries(translatedEntries)) {
      if (typeof translatedText !== 'string') {
        continue;
      }
      copyKeys[key] = copyKeys[key] || {};
      copyKeys[key][targetLocale] = translatedText;
      localeUpdates += 1;
      localizedEntryCount += 1;
    }

    byLocale[targetLocale] = localeUpdates;
  }

  projectDoc.pipelines = projectDoc.pipelines || {};
  projectDoc.pipelines.localization = projectDoc.pipelines.localization || {};
  projectDoc.pipelines.localization.mode = mode;
  projectDoc.pipelines.localization.sourceLocale = sourceLocale;

  return {
    mode,
    sourceLocale,
    targetLocales,
    sourceEntryCount,
    localizedEntryCount,
    byLocale
  };
}
