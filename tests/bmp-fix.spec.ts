import { test, expect } from '@playwright/test';
import { FIXTURE_PATHS, convertImages, gotoApp, resetApp, setTargetFormat, uploadWithPicker, waitForConversionDone } from '../e2e/helpers';

test.describe('BMP Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await resetApp(page);
  });

  test('BMP → JPG conversion works', async ({ page }) => {
    await setTargetFormat(page, 'jpg');
    await uploadWithPicker(page, FIXTURE_PATHS.bmp);
    await convertImages(page);
    await waitForConversionDone(page, 1);

    await expect(page.locator('.converted-zone .image-card h4')).toContainText(['sample-bmp.jpg']);
    await expect(page.locator('.converted-zone .pill--success')).toContainText('1 ready');
  });

  test('JPG → BMP conversion works', async ({ page }) => {
    await setTargetFormat(page, 'bmp');
    await uploadWithPicker(page, FIXTURE_PATHS.jpg);
    await convertImages(page);
    await waitForConversionDone(page, 1);

    await expect(page.locator('.converted-zone .image-card h4')).toContainText(['sample-jpg.bmp']);
    await expect(page.locator('.converted-zone .pill--success')).toContainText('1 ready');
  });
});
