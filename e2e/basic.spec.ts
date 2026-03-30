import { test, expect } from '@playwright/test';
import {
  FIXTURE_PATHS,
  convertImages,
  ensureNoHorizontalOverflow,
  gotoApp,
  resetApp,
  saveDownload,
  saveScreenshot,
  setTargetFormat,
  uploadViaDrop,
  uploadWithPicker,
  waitForConversionDone,
  inspectZip,
  writeJsonArtifact,
} from './helpers';

test.describe('Image Format Converter - core functionality', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await resetApp(page);
  });

  test('app loads correctly and renders all primary areas', async ({ page }, testInfo) => {
    await expect(page.locator('.menu-bar')).toBeVisible();
    await expect(page.locator('.upload-zone')).toBeVisible();
    await expect(page.locator('.converted-zone')).toBeVisible();
    await expect(page.getByRole('button', { name: /Convert images/i })).toBeVisible();
    await expect(page.locator('.format-grid')).toBeVisible();
    await saveScreenshot(page, testInfo, 'app-loaded');
  });

  test('upload, validation, conversion, downloads, and error handling work on the live app', async ({ page }, testInfo) => {
    const downloadAllButton = page.getByRole('button', { name: /^Download All$/i });
    const downloadZipButton = page.getByRole('button', { name: /Download all as ZIP/i });
    const convertButton = page.getByRole('button', { name: /Convert images/i });

    await expect(convertButton).toBeDisabled();
    await expect(downloadAllButton).toBeDisabled();
    await expect(downloadZipButton).toBeDisabled();

    await uploadViaDrop(page, [FIXTURE_PATHS.jpg]);
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(1);
    await expect(page.locator('.upload-panel .image-card h4')).toContainText(['sample-jpg.jpg']);
    await ensureNoHorizontalOverflow(page, '.upload-panel .image-grid');
    await saveScreenshot(page, testInfo, 'single-upload-drop');

    await page.locator('.image-card__remove').click();
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(0);

    await uploadWithPicker(page, [FIXTURE_PATHS.png]);
    await expect(page.locator('.helper-text--warning')).toContainText('Cannot upload PNG file when PNG is selected as target format.');
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(0);

    await setTargetFormat(page, 'webp');
    await uploadWithPicker(page, [FIXTURE_PATHS.jpg, FIXTURE_PATHS.png]);
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(2);
    await ensureNoHorizontalOverflow(page, '.upload-panel .image-grid');

    await setTargetFormat(page, 'jpg');
    await expect(page.locator('.helper-callout--warning')).toContainText('1 file already matches JPG and will be skipped.');
    await expect(convertButton).toBeEnabled();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Clear all/i }).click();
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(0);

    await uploadWithPicker(page, [FIXTURE_PATHS.jpg]);
    await expect(page.locator('.helper-text--warning')).toContainText('Cannot upload JPG file when JPG is selected as target format.');
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(0);
    await expect(convertButton).toBeDisabled();

    await uploadWithPicker(page, [FIXTURE_PATHS.txt]);
    await expect(page.locator('.helper-text--warning')).toContainText('Please upload supported image files only.');

    await page.reload();
    await setTargetFormat(page, 'webp');
    await uploadWithPicker(page, [FIXTURE_PATHS.jpg, FIXTURE_PATHS.png]);
    await convertImages(page);
    await waitForConversionDone(page, 2);
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(0);
    const convertedNames = (await page.locator('.converted-zone .image-card h4').allTextContents()).sort();
    expect(convertedNames).toEqual(['sample-jpg.webp', 'sample-png.webp']);
    await saveScreenshot(page, testInfo, 'converted-output');

    const downloads: string[] = [];
    page.on('download', async (download) => {
      const suggested = download.suggestedFilename();
      downloads.push(await saveDownload(download, suggested));
    });

    await downloadAllButton.click();
    await expect.poll(() => downloads.filter((item) => item.endsWith('.webp')).length, { timeout: 8_000 }).toBeGreaterThanOrEqual(2);

    await downloadZipButton.click();
    await expect.poll(() => downloads.some((item) => item.endsWith('.zip')), { timeout: 8_000 }).toBeTruthy();
    const zipPath = downloads.find((item) => item.endsWith('.zip'))!;
    const zipEntries = await inspectZip(zipPath);
    await writeJsonArtifact('zip-contents.json', zipEntries);
    expect(zipEntries.length).toBe(2);
    expect(zipEntries.some((entry) => entry.name.includes('sample-jpg'))).toBeTruthy();
    expect(zipEntries.some((entry) => entry.name.includes('sample-png'))).toBeTruthy();

    await expect(page.locator('.converted-zone .image-card button')).toHaveCount(0);
    await saveScreenshot(page, testInfo, 'downloads-ready');
  });
});
