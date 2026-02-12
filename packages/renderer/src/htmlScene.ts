import path from 'node:path';

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toFileUri(filePath) {
  const normalized = path.resolve(filePath).split(path.sep).join('/');
  return `file://${encodeURI(normalized)}`;
}

function backgroundCss(background) {
  if (background?.type === 'gradient') {
    const from = background.from || '#111827';
    const to = background.to || '#030712';
    const direction = background.direction || '180deg';
    return `background: linear-gradient(${direction}, ${from}, ${to});`;
  }

  return `background: ${background?.value || '#111827'};`;
}

function textStyle(box) {
  return [
    `left:${box.x}px`,
    `top:${box.y}px`,
    `width:${box.w}px`,
    `height:${box.h}px`,
    `font-family:'${box.font || 'SF Pro'}','Apple SD Gothic Neo',sans-serif`,
    `font-size:${box.size || 48}px`,
    `font-weight:${box.weight || 600}`,
    `text-align:${box.align || 'left'}`,
    'line-height:1.2',
    'overflow:hidden',
    'white-space:pre-wrap',
    'word-break:break-word'
  ].join(';');
}

export function sceneToHtml(scene) {
  const bg = backgroundCss(scene.background);
  const frameEnabled = scene.frame?.enabled !== false;

  const shot = scene.shotPlacement;
  const title = scene.text.title;
  const subtitle = scene.text.subtitle;

  const frameInset = scene.frame?.inset || 0;
  const frameRadius = scene.frame?.radius || 0;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; width: 100%; height: 100%; }
  body { overflow: hidden; }
  #root {
    position: relative;
    width: ${scene.width}px;
    height: ${scene.height}px;
    ${bg}
    color: #f9fafb;
  }
  .frame {
    position: absolute;
    left: ${frameInset}px;
    top: ${frameInset}px;
    width: ${scene.width - frameInset * 2}px;
    height: ${scene.height - frameInset * 2}px;
    border-radius: ${frameRadius}px;
    border: 3px solid rgba(255,255,255,0.25);
    pointer-events: none;
    box-sizing: border-box;
  }
  .shot-wrap {
    position: absolute;
    left: ${shot.x}px;
    top: ${shot.y}px;
    width: ${shot.w}px;
    height: ${shot.h}px;
    overflow: hidden;
    border-radius: ${shot.cornerRadius || 0}px;
    box-shadow: 0 32px 120px rgba(0,0,0,0.36);
    background: rgba(15, 23, 42, 0.7);
  }
  .shot {
    width: 100%;
    height: 100%;
    object-fit: ${shot.fit || 'cover'};
  }
  .text {
    position: absolute;
    color: #f9fafb;
    text-shadow: 0 2px 10px rgba(0,0,0,0.2);
  }
</style>
</head>
<body>
  <div id="root">
    ${frameEnabled ? '<div class="frame"></div>' : ''}
    <div class="shot-wrap"><img class="shot" src="${toFileUri(scene.shotImagePath)}" /></div>
    <div class="text" style="${textStyle(title)}">${escapeHtml(title.value)}</div>
    <div class="text" style="${textStyle(subtitle)}">${escapeHtml(subtitle.value)}</div>
  </div>
</body>
</html>`;
}
