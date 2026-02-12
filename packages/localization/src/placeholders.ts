const PLACEHOLDER_PATTERNS = [
  /\{[a-zA-Z0-9_.-]+\}/g,
  /\{\{[^{}]+\}\}/g,
  /%\d*\$?[sdif@]/g
];

export function extractPlaceholders(text) {
  const source = String(text || '');
  const found = [];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = source.match(pattern);
    if (matches) {
      found.push(...matches);
    }
  }

  return [...new Set(found)].sort();
}

function sameSet(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  const lhs = [...left].sort();
  const rhs = [...right].sort();
  return lhs.every((value, index) => value === rhs[index]);
}

export function assertPlaceholdersPreserved(sourceText, translatedText, key = 'unknown') {
  const source = extractPlaceholders(sourceText);
  const translated = extractPlaceholders(translatedText);

  if (!sameSet(source, translated)) {
    const err = new Error(`Placeholder mismatch for key: ${key}`);
    err.code = 'PLACEHOLDER_MISMATCH';
    err.meta = { key, source, translated };
    throw err;
  }
}
