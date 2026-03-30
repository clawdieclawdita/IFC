import { expect, Page, TestInfo } from '@playwright/test';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export const FIXTURES_DIR = path.resolve(process.cwd(), 'e2e', 'fixtures');
export const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts', 'screenshots');
export const DOWNLOAD_DIR = path.resolve(process.cwd(), 'artifacts', 'downloads');

export const FIXTURE_PATHS = {
  jpg: path.join(FIXTURES_DIR, 'sample-jpg.jpg'),
  png: path.join(FIXTURES_DIR, 'sample-png.png'),
  bmp: path.join(FIXTURES_DIR, 'sample-bmp.bmp'),
  tiff: path.join(FIXTURES_DIR, 'sample-tiff.tiff'),
  webp: path.join(FIXTURES_DIR, 'sample-webp.webp'),
  gif: path.join(FIXTURES_DIR, 'sample-gif.gif'),
  svg: path.join(FIXTURES_DIR, 'sample-svg.svg'),
  txt: path.join(FIXTURES_DIR, 'not-an-image.txt'),
};

export async function gotoApp(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Image Format Converter' })).toBeVisible();
}

export async function resetApp(page: Page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Image Format Converter' })).toBeVisible();
}

export async function uploadWithPicker(page: Page, files: string | string[]) {
  await page.locator('input[type="file"]').setInputFiles(files);
}

export async function uploadViaDrop(page: Page, files: string[]) {
  const payload = files.map((filePath) => ({
    name: path.basename(filePath),
    mimeType: mimeTypeForPath(filePath),
    buffer: fsSync.readFileSync(filePath),
  }));

  const dataTransfer = await page.evaluateHandle((items) => {
    const dt = new DataTransfer();
    for (const item of items) {
      const bytes = new Uint8Array(item.buffer.data);
      const file = new File([bytes], item.name, { type: item.mimeType });
      dt.items.add(file);
    }
    return dt;
  }, payload);

  await page.locator('.upload-zone').dispatchEvent('dragenter', { dataTransfer });
  await page.locator('.upload-zone').dispatchEvent('dragover', { dataTransfer });
  await page.locator('.upload-zone').dispatchEvent('drop', { dataTransfer });
}

function mimeTypeForPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
  }[ext] ?? 'application/octet-stream';
}

export async function setTargetFormat(page: Page, format: string) {
  await page.locator(`label.format-option:has(input[value="${format}"])`).click();
  await expect(page.locator(`input[name="target-format"][value="${format}"]`)).toBeChecked();
}

export async function convertImages(page: Page) {
  await page.getByRole('button', { name: /Convert images/i }).click();
}

export async function waitForConversionDone(page: Page, expectedCount: number) {
  await expect(page.locator('.converted-zone .image-card--converted')).toHaveCount(expectedCount, { timeout: 30_000 });
  await expect(page.locator('.progress-block__meta strong')).toContainText('100%');
}

export async function saveScreenshot(page: Page, testInfo: TestInfo, label: string) {
  const safe = `${testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  const filePath = path.join(SCREENSHOT_DIR, safe);
  await page.screenshot({ path: filePath, fullPage: true });
  await testInfo.attach(label, { path: filePath, contentType: 'image/png' });
  return filePath;
}

export async function saveDownload(download: any, targetName: string) {
  const savePath = path.join(DOWNLOAD_DIR, targetName);
  await download.saveAs(savePath);
  return savePath;
}

export async function inspectZip(zipPath: string) {
  const zip = new AdmZip(zipPath);
  return zip.getEntries().map((entry) => ({ name: entry.entryName, size: entry.header.size }));
}

export async function getBounding(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  return box;
}

export async function collectAnimationMetrics(page: Page) {
  return page.evaluate(async () => {
    const samples: Array<{ t: number; count: number; left: number | null }> = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const node = document.querySelector('.swipe-overlay__card') as HTMLElement | null;
        const rect = node?.getBoundingClientRect();
        samples.push({ t: performance.now() - start, count: document.querySelectorAll('.swipe-overlay__card').length, left: rect?.left ?? null });
        if (performance.now() - start >= 1500) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
    const visible = samples.filter((s) => s.count > 0 && s.left !== null);
    const deltas = visible.slice(1).map((s, i) => (s.left as number) - (visible[i].left as number));
    const negativeSteps = deltas.filter((d) => d < -1).length;
    return {
      sampleCount: samples.length,
      visibleSamples: visible.length,
      startMs: visible[0]?.t ?? null,
      endMs: visible.at(-1)?.t ?? null,
      durationMs: visible.length ? (visible.at(-1)!.t - visible[0]!.t) : 0,
      maxStepPx: deltas.length ? Math.max(...deltas) : 0,
      minStepPx: deltas.length ? Math.min(...deltas) : 0,
      negativeSteps,
    };
  });
}

export async function ensureNoHorizontalOverflow(page: Page, selector: string) {
  const overflow = await page.locator(selector).evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

export async function writeJsonArtifact(name: string, data: unknown) {
  const outPath = path.resolve(process.cwd(), 'artifacts', name);
  await fs.writeFile(outPath, JSON.stringify(data, null, 2));
  return outPath;
}
