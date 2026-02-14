import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { assertPlaceholdersPreserved } from './placeholders.ts';

const LEGACY_FILE_ARGS_TEMPLATE = ['translate', '--in', '{INPUT}', '--out', '{OUTPUT}', '--to', '{LOCALE}'];

async function loadCache(cachePath) {
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cachePath, cache) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
}

function hashKey(parts) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(parts))
    .digest('hex');
}

function formatArgs(argsTemplate, replacements) {
  return (argsTemplate || []).map((entry) => {
    let value = entry;
    for (const [key, replacement] of Object.entries(replacements)) {
      value = value.replaceAll(`{${key}}`, replacement);
    }
    return value;
  });
}

function normalizeArgsTemplate(argsTemplate) {
  return (argsTemplate || [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function isLegacyFileArgsTemplate(argsTemplate) {
  const normalized = normalizeArgsTemplate(argsTemplate);
  if (normalized.length !== LEGACY_FILE_ARGS_TEMPLATE.length) {
    return false;
  }
  return normalized.every((value, index) => value === LEGACY_FILE_ARGS_TEMPLATE[index]);
}

function isGeminiCommand(command) {
  const commandName = path.basename(String(command || '')).toLowerCase();
  return commandName === 'gemini' || commandName === 'gemini-cli';
}

function shouldUseGeminiPromptMode(command, argsTemplate) {
  if (!isGeminiCommand(command)) {
    return false;
  }

  const normalized = normalizeArgsTemplate(argsTemplate);
  return normalized.length === 0 || isLegacyFileArgsTemplate(argsTemplate);
}

function buildGeminiPrompt(payload) {
  const stylePrompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  const sections = [
    'You are a localization engine for app store screenshots.',
    `Translate each entry from ${payload.sourceLocale} to ${payload.targetLocale}.`,
    'Never alter placeholders such as {app_name}, %@, {{count}}, or %d.',
    'Keep brand names and product terms consistent.',
    'Return strict JSON only with this format: {"entries":{"key":"translated"}}.'
  ];

  if (stylePrompt) {
    sections.push(`Style guidance:\n${stylePrompt}`);
  }

  return sections.join('\n');
}

function tryParseJson(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const fenceStart = raw.indexOf('```');
    if (fenceStart >= 0) {
      const firstBrace = raw.indexOf('{', fenceStart);
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const fencedCandidate = raw.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(fencedCandidate);
        } catch {
          // fall through to generic brace extraction
        }
      }
    }

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return null;
    }

    const candidate = raw.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

async function runCli({ command, args, inputFilePath, timeoutSec, cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutSec * 1000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`LLM CLI timed out after ${timeoutSec}s`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`LLM CLI exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      resolve({ stdout, stderr, code });
    });

    fs.readFile(inputFilePath)
      .then((payload) => child.stdin.end(payload))
      .catch((error) => {
        child.stdin.end();
        reject(error);
      });
  });
}

async function runCliTranslation({
  command,
  argsTemplate,
  payload,
  timeoutSec,
  cwd
}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dma-llm-'));
  const inputFilePath = path.join(tempDir, 'input.json');
  const outputFilePath = path.join(tempDir, 'output.json');

  await fs.writeFile(inputFilePath, JSON.stringify(payload, null, 2));

  const formattedArgs = formatArgs(argsTemplate, {
    INPUT: inputFilePath,
    OUTPUT: outputFilePath,
    LOCALE: payload.targetLocale,
    SOURCE_LOCALE: payload.sourceLocale,
    TARGET_LOCALE: payload.targetLocale
  });

  const useGeminiPromptMode = shouldUseGeminiPromptMode(command, argsTemplate);
  const args = useGeminiPromptMode
    ? ['-p', buildGeminiPrompt(payload)]
    : formattedArgs;

  let result = null;
  try {
    result = await runCli({
      command,
      args,
      inputFilePath,
      timeoutSec,
      cwd
    });
  } catch (error) {
    const shouldRetryWithGeminiPrompt =
      !useGeminiPromptMode &&
      isGeminiCommand(command) &&
      isLegacyFileArgsTemplate(argsTemplate) &&
      String(error?.message || '').includes('Unknown arguments');

    if (!shouldRetryWithGeminiPrompt) {
      throw error;
    }

    result = await runCli({
      command,
      args: ['-p', buildGeminiPrompt(payload)],
      inputFilePath,
      timeoutSec,
      cwd
    });
  }

  let translated = null;
  try {
    const output = await fs.readFile(outputFilePath, 'utf8');
    translated = tryParseJson(output);
  } catch {
    translated = null;
  }

  if (!translated) {
    translated = tryParseJson(result?.stdout || '');
  }

  if (!translated.entries || typeof translated.entries !== 'object') {
    throw new Error('LLM CLI output must include { "entries": { ... } }');
  }

  return translated.entries;
}

export async function translateWithCli(options) {
  const {
    command,
    argsTemplate,
    sourceLocale,
    targetLocale,
    entries,
    promptVersion = 'v1',
    prompt = null,
    glossary = null,
    styleGuide = null,
    timeoutSec = 120,
    cachePath = '.dma/cache/translation-cache.json',
    cwd = process.cwd()
  } = options;

  const cache = await loadCache(cachePath);
  const translatedEntries = {};
  const pending = {};

  for (const [key, text] of Object.entries(entries)) {
    const cacheKey = hashKey({ text, sourceLocale, targetLocale, promptVersion });
    const cached = cache[cacheKey];
    if (cached) {
      translatedEntries[key] = cached;
      continue;
    }
    pending[key] = text;
  }

  if (Object.keys(pending).length > 0) {
    const payload = {
      sourceLocale,
      targetLocale,
      prompt: typeof prompt === 'string' ? prompt : null,
      glossary,
      styleGuide: typeof prompt === 'string' && prompt.trim() ? prompt : styleGuide,
      entries: pending
    };

    const fresh = await runCliTranslation({
      command,
      argsTemplate,
      payload,
      timeoutSec,
      cwd
    });

    for (const [key, sourceText] of Object.entries(pending)) {
      const translatedText = fresh[key];
      if (typeof translatedText !== 'string') {
        throw new Error(`Missing translated value for key: ${key}`);
      }

      assertPlaceholdersPreserved(sourceText, translatedText, key);

      translatedEntries[key] = translatedText;
      const cacheKey = hashKey({ text: sourceText, sourceLocale, targetLocale, promptVersion });
      cache[cacheKey] = translatedText;
    }

    await saveCache(cachePath, cache);
  }

  return translatedEntries;
}
