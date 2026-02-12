const AVG_CHAR_WIDTH_RATIO = 0.56;
const DEFAULT_LINE_HEIGHT = 1.2;

function tokenize(text) {
  if (/\s/.test(text)) {
    return {
      mode: 'word',
      tokens: text.split(/\s+/).filter(Boolean)
    };
  }

  return {
    mode: 'char',
    tokens: [...text]
  };
}

export function layoutTextBox(text, boxWidth, boxHeight, fontSize, options = {}) {
  const lineHeightMultiplier = options.lineHeightMultiplier || DEFAULT_LINE_HEIGHT;
  const ellipsis = options.ellipsis !== false;
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return {
      lines: [],
      truncated: false,
      text: '',
      maxLines: 0,
      maxCharsPerLine: 0
    };
  }

  const maxCharsPerLine = Math.max(1, Math.floor(boxWidth / (fontSize * AVG_CHAR_WIDTH_RATIO)));
  const maxLines = Math.max(1, Math.floor(boxHeight / (fontSize * lineHeightMultiplier)));

  const { mode, tokens } = tokenize(normalized);
  const lines = [];
  let current = '';

  const flushCurrent = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  for (const token of tokens) {
    const candidate = mode === 'word'
      ? (current ? `${current} ${token}` : token)
      : `${current}${token}`;

    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    flushCurrent();

    if (token.length > maxCharsPerLine) {
      let segment = token;
      while (segment.length > maxCharsPerLine) {
        lines.push(segment.slice(0, maxCharsPerLine));
        segment = segment.slice(maxCharsPerLine);
      }
      current = segment;
    } else {
      current = token;
    }
  }

  flushCurrent();

  let truncated = false;
  let visibleLines = lines;

  if (lines.length > maxLines) {
    truncated = true;
    visibleLines = lines.slice(0, maxLines);
  }

  if (truncated && ellipsis && visibleLines.length > 0) {
    const last = visibleLines[visibleLines.length - 1];
    if (last.length >= maxCharsPerLine) {
      visibleLines[visibleLines.length - 1] = `${last.slice(0, maxCharsPerLine - 3)}...`;
    } else {
      visibleLines[visibleLines.length - 1] = `${last}...`;
    }
  }

  return {
    lines: visibleLines,
    truncated,
    text: visibleLines.join('\n'),
    maxLines,
    maxCharsPerLine
  };
}
