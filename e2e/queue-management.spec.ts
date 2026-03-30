import { expect, test } from '@playwright/test';
import {
  FIXTURE_PATHS,
  convertImages,
  gotoApp,
  resetApp,
  saveScreenshot,
  setTargetFormat,
  uploadWithPicker,
  waitForConversionDone,
} from './helpers';

test.describe('Image Format Converter - Phase 3 queue management', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await resetApp(page);
    await setTargetFormat(page, 'webp');
  });

  test('queue persists across refreshes', async ({ page }, testInfo) => {
    await uploadWithPicker(page, [FIXTURE_PATHS.jpg, FIXTURE_PATHS.png]);
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(2);

    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('image-converter.queue') || '{}'))).toMatchObject({
      queue: [
        expect.objectContaining({ name: 'sample-jpg.jpg' }),
        expect.objectContaining({ name: 'sample-png.png' }),
      ],
    });

    const persistedState = await page.evaluate(() => JSON.parse(localStorage.getItem('image-converter.queue') || '{}'));
    expect(Array.isArray(persistedState.queue)).toBeTruthy();
    expect(persistedState.queue).toHaveLength(2);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(2);
    await expect(page.locator('.upload-panel .image-card h4')).toContainText(['sample-jpg.jpg', 'sample-png.png']);
    await saveScreenshot(page, testInfo, 'queue-persistence-refresh');
  });

  test('drag and drop reorders the upload grid', async ({ page }, testInfo) => {
    await uploadWithPicker(page, [FIXTURE_PATHS.jpg, FIXTURE_PATHS.png, FIXTURE_PATHS.gif]);
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(3);

    const before = await page.locator('.upload-panel .image-card h4').allTextContents();
    expect(before).toEqual(['sample-jpg.jpg', 'sample-png.png', 'sample-gif.gif']);

    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    const sourceCard = page.locator('.upload-panel .image-card').nth(0);
    const targetCard = page.locator('.upload-panel .image-card').nth(2);

    await sourceCard.dispatchEvent('dragstart', { dataTransfer });
    await targetCard.dispatchEvent('dragenter', { dataTransfer });
    await targetCard.dispatchEvent('dragover', { dataTransfer });
    await targetCard.dispatchEvent('drop', { dataTransfer });
    await sourceCard.dispatchEvent('dragend', { dataTransfer });

    await expect.poll(async () => page.locator('.upload-panel .image-card h4').allTextContents()).toEqual([
      'sample-png.png',
      'sample-gif.gif',
      'sample-jpg.jpg',
    ]);

    await expect(page.locator('.upload-panel .image-card')).toHaveCount(3);

    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('image-converter.queue') || '{}'))).toEqual({
      queue: [
        expect.objectContaining({ name: 'sample-png.png' }),
        expect.objectContaining({ name: 'sample-gif.gif' }),
        expect.objectContaining({ name: 'sample-jpg.jpg' }),
      ],
      converted: [],
      paused: false,
      processing: [],
    });

    const latestPersistedState = await page.evaluate(() => JSON.parse(localStorage.getItem('image-converter.queue') || '{}'));
    expect(latestPersistedState.queue.map((item: { name: string }) => item.name)).toEqual([
      'sample-png.png',
      'sample-gif.gif',
      'sample-jpg.jpg',
    ]);

    await saveScreenshot(page, testInfo, 'drag-drop-reorder');
  });

  test('pause resume and cancel keep batch state intact', async ({ page }, testInfo) => {
    await uploadWithPicker(page, [FIXTURE_PATHS.jpg, FIXTURE_PATHS.png, FIXTURE_PATHS.bmp]);
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(3);

    await convertImages(page);

    const pauseButton = page.locator('.queue-panel__actions button', { hasText: 'Pause' });
    await expect(pauseButton).toBeVisible({ timeout: 30_000 });
    await expect(pauseButton).toBeEnabled({ timeout: 30_000 });
    await pauseButton.click({ timeout: 30_000 });

    await expect(page.locator('.queue-panel__state')).toContainText('Paused');
    await expect(page.getByRole('button', { name: /Convert images/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Resume$/i })).toBeVisible();
    await saveScreenshot(page, testInfo, 'pause-resume-controls');

    await page.getByRole('button', { name: /Cancel sample-png\.png/i }).click();
    await expect(page.locator('.upload-panel .image-card h4')).not.toContainText(['sample-png.png']);
    await saveScreenshot(page, testInfo, 'cancel-item');

    await page.getByRole('button', { name: /^Resume$/i }).click();
    await waitForConversionDone(page, 2);
    await expect(page.locator('.upload-panel .image-card')).toHaveCount(0);
    await expect(page.locator('.converted-zone .image-card h4')).toContainText(['sample-jpg.webp', 'sample-bmp.webp']);
  });
});
