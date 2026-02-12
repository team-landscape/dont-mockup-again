import { sceneToHtml } from './htmlScene.ts';

export async function createPlaywrightRenderer() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return null;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  return {
    async render(scene, outPath) {
      await page.setViewportSize({ width: scene.width, height: scene.height });
      await page.setContent(sceneToHtml(scene), { waitUntil: 'domcontentloaded' });

      await page.evaluate(async () => {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      });

      await page.screenshot({ path: outPath, type: 'png' });
    },
    async close() {
      await context.close();
      await browser.close();
    }
  };
}
