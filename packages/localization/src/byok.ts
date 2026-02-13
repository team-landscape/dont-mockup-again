import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertPlaceholdersPreserved } from './placeholders.ts';

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

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

function normalizeEndpointPath(endpointPath) {
  const normalized = String(endpointPath || '/chat/completions').trim();
  if (!normalized) {
    return '/chat/completions';
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function tryParseJson(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
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

function extractTextContent(responseJson) {
  const content = responseJson?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.text || '';
      })
      .join('\n');
  }

  if (responseJson && responseJson.entries && typeof responseJson.entries === 'object') {
    return JSON.stringify({ entries: responseJson.entries });
  }

  return '';
}

function resolveApiKey(apiKey, apiKeyEnv) {
  if (typeof apiKey === 'string' && apiKey.trim()) {
    return apiKey.trim();
  }

  const envKey = typeof apiKeyEnv === 'string' && apiKeyEnv.trim()
    ? apiKeyEnv.trim()
    : 'OPENAI_API_KEY';
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim();
  }

  throw new Error(`BYOK API key not found. Set env var ${envKey} or pass apiKey.`);
}

async function runByokTranslation({
  baseUrl,
  endpointPath,
  model,
  apiKey,
  apiKeyEnv,
  timeoutSec,
  payload
}) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch API is unavailable in this Node runtime.');
  }

  const resolvedApiKey = resolveApiKey(apiKey, apiKeyEnv);
  const requestUrl = `${normalizeBaseUrl(baseUrl)}${normalizeEndpointPath(endpointPath)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSec * 1000);

  let response = null;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${resolvedApiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: [
              'You are a localization engine for app store screenshots.',
              'Translate each entry naturally for the target locale.',
              'Do not modify placeholders like {app_name}, %@, {{count}}.',
              'Return strict JSON only with this shape: {"entries":{"key":"translated"}}.'
            ].join(' ')
          },
          {
            role: 'user',
            content: JSON.stringify(payload)
          }
        ]
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`BYOK request timed out after ${timeoutSec}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  const responseJson = tryParseJson(rawText);
  if (!response.ok) {
    const detail = responseJson ? JSON.stringify(responseJson) : rawText;
    throw new Error(`BYOK request failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const rawContent = extractTextContent(responseJson);
  const parsed = tryParseJson(rawContent) || responseJson;
  if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object') {
    throw new Error('BYOK response must include { "entries": { ... } }');
  }

  return parsed.entries;
}

export async function translateWithByok(options) {
  const {
    baseUrl = 'https://api.openai.com/v1',
    endpointPath = '/chat/completions',
    model = 'gpt-4o-mini',
    apiKey = '',
    apiKeyEnv = 'OPENAI_API_KEY',
    sourceLocale,
    targetLocale,
    entries,
    promptVersion = 'v1',
    glossary = null,
    styleGuide = null,
    timeoutSec = 120,
    cachePath = '.storeshot/cache/translation-cache.json'
  } = options;

  const cache = await loadCache(cachePath);
  const translatedEntries = {};
  const pending = {};

  for (const [key, text] of Object.entries(entries || {})) {
    if (typeof text !== 'string') {
      continue;
    }

    const cacheKey = hashKey({
      provider: 'byok',
      baseUrl,
      endpointPath,
      model,
      text,
      sourceLocale,
      targetLocale,
      promptVersion
    });
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
      glossary,
      styleGuide,
      entries: pending
    };

    const fresh = await runByokTranslation({
      baseUrl,
      endpointPath,
      model,
      apiKey,
      apiKeyEnv,
      timeoutSec,
      payload
    });

    for (const [key, sourceText] of Object.entries(pending)) {
      const translatedText = fresh[key];
      if (typeof translatedText !== 'string') {
        throw new Error(`Missing translated value for key: ${key}`);
      }

      assertPlaceholdersPreserved(sourceText, translatedText, key);

      translatedEntries[key] = translatedText;
      const cacheKey = hashKey({
        provider: 'byok',
        baseUrl,
        endpointPath,
        model,
        text: sourceText,
        sourceLocale,
        targetLocale,
        promptVersion
      });
      cache[cacheKey] = translatedText;
    }

    await saveCache(cachePath, cache);
  }

  return translatedEntries;
}
