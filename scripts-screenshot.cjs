const { chromium } = require('/home/pschivo/mission-control/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const outDir = path.join(process.cwd(), 'evidence-phase2');
  fs.mkdirSync(outDir, { recursive: true });

  page.on('dialog', async (dialog) => dialog.dismiss());

  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, '01-split-empty.png'), fullPage: true });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles([
    path.join(process.cwd(), 'public/sample-landscape.svg'),
    path.join(process.cwd(), 'public/sample-card.svg'),
  ]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '02-split-uploaded.png'), fullPage: true });

  await page.locator('input[value="webp"]').check({ force: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, '03-format-selected.png'), fullPage: true });

  await page.getByRole('button', { name: /Convert images/i }).click();
  await page.waitForTimeout(280);
  await page.screenshot({ path: path.join(outDir, '04-flip-shake.png'), fullPage: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '05-left-to-right-transition.png'), fullPage: true });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(outDir, '06-output-ready.png'), fullPage: true });

  await browser.close();
})();
