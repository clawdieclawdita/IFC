import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { FIXTURE_PATHS, SCREENSHOT_DIR, convertImages, gotoApp, inspectZip, resetApp, saveScreenshot, setTargetFormat, uploadWithPicker, waitForConversionDone } from '../e2e/helpers';

const RELATIVE_FIXTURE = path.join(SCREENSHOT_DIR, 'album-photo.jpg');

async function openPanel(page, name: string) {
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  await expect(page.locator('#settings-panel-title')).toContainText(name);
}

async function closePanel(page) {
  await page.getByRole('button', { name: /close panel/i }).click();
}

test.describe('Phase 5 preservation settings', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(path.dirname(RELATIVE_FIXTURE), { recursive: true });
    fs.copyFileSync(FIXTURE_PATHS.jpg, RELATIVE_FIXTURE);
  });

  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await resetApp(page);
  });

  test('privacy panel, filename panel, persistence, and zip folder structure all work', async ({ page }, testInfo) => {
    await uploadWithPicker(page, FIXTURE_PATHS.jpg);

    await openPanel(page, 'Privacy');
    const preserveMetadata = page.locator('#privacy-preserve-metadata');
    const stripMetadata = page.locator('#privacy-strip-metadata');
    const preserveFolders = page.locator('#privacy-preserve-folders');

    await expect(preserveMetadata).not.toBeChecked();
    await expect(stripMetadata).not.toBeChecked();

    await preserveMetadata.check();
    await expect(preserveMetadata).toBeChecked();
    await expect(stripMetadata).toBeDisabled();
    await preserveFolders.check();
    await saveScreenshot(page, testInfo, 'privacy-panel-phase5');
    await closePanel(page);

    await openPanel(page, 'Filename');
    await page.locator('#filename-custom').check();
    await page.locator('#filename-pattern').fill('{name}_{format}_{date}_{seq}');
    await expect(page.locator('.preview-value--filename')).toContainText('my-photo_png_');
    await expect(page.locator('.preview-value--filename')).toContainText('.png');
    await saveScreenshot(page, testInfo, 'filename-panel-phase5');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#settings-panel-title')).toContainText('Filename');
    await expect(page.locator('#filename-custom')).toBeChecked();
    await expect(page.locator('#filename-pattern')).toHaveValue('{name}_{format}_{date}_{seq}');

    const stored = await page.evaluate(() => ({
      preserveMetadata: localStorage.getItem('image-converter.preserveMetadata'),
      preserveFolderStructure: localStorage.getItem('image-converter.preserveFolderStructure'),
      filenameConvention: localStorage.getItem('image-converter.filenameConvention'),
      customFilenamePattern: localStorage.getItem('image-converter.customFilenamePattern'),
    }));

    expect(stored.preserveMetadata).toBe('true');
    expect(stored.preserveFolderStructure).toBe('true');
    expect(stored.filenameConvention).toBe('custom');
    expect(stored.customFilenamePattern).toBe('{name}_{format}_{date}_{seq}');

    await closePanel(page);
    await setTargetFormat(page, 'png');
    await convertImages(page);
    await waitForConversionDone(page, 1);
    await expect(page.locator('.converted-zone .image-card h4')).toContainText(['sample-jpg_png_']);
  });

  test('zip keeps folder structure when enabled', async ({ page, request }, testInfo) => {
    await openPanel(page, 'Privacy');
    await page.locator('#privacy-preserve-folders').check();
    await page.getByRole('button', { name: /close panel/i }).click();

    const buffer = fs.readFileSync(RELATIVE_FIXTURE);
    const dataTransfer = await page.evaluateHandle(({ name, mimeType, bytes }) => {
      const dt = new DataTransfer();
      const file = new File([new Uint8Array(bytes)], name, { type: mimeType });
      Object.defineProperty(file, 'webkitRelativePath', { value: 'album/photo.jpg' });
      dt.items.add(file);
      return dt;
    }, { name: 'photo.jpg', mimeType: 'image/jpeg', bytes: Array.from(buffer) });

    await page.locator('.upload-zone').dispatchEvent('dragenter', { dataTransfer });
    await page.locator('.upload-zone').dispatchEvent('dragover', { dataTransfer });
    await page.locator('.upload-zone').dispatchEvent('drop', { dataTransfer });

    await setTargetFormat(page, 'webp');
    await convertImages(page);
    await waitForConversionDone(page, 1);

    const convertedDir = path.resolve(process.cwd(), 'converted');
    const newestFile = fs.readdirSync(convertedDir)
      .map((name) => ({ name, mtimeMs: fs.statSync(path.join(convertedDir, name)).mtimeMs }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

    expect(newestFile?.name).toBeTruthy();

    const zipResponse = await request.post('http://192.168.1.200:4444/api/zip', {
      data: {
        convertedFiles: [
          {
            downloadUrl: `http://192.168.1.200:4444/converted/${newestFile.name}`,
            convertedName: 'photo.webp',
            relativePath: 'album/photo.jpg',
          },
        ],
        preserveFolderStructure: true,
      },
    });

    expect(zipResponse.ok()).toBeTruthy();
    const zipPayload = await zipResponse.json();
    const zipAsset = await request.get(zipPayload.zipUrl);
    expect(zipAsset.ok()).toBeTruthy();

    const zipPath = path.join(SCREENSHOT_DIR, `${testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip`);
    fs.writeFileSync(zipPath, Buffer.from(await zipAsset.body()));
    const entries = await inspectZip(zipPath);
    expect(entries.some((entry) => entry.name.startsWith('album/'))).toBeTruthy();
  });
});
