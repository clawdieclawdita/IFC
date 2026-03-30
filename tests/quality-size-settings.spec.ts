import { test, expect } from '@playwright/test';
import { FIXTURE_PATHS, gotoApp, resetApp, saveScreenshot, uploadWithPicker } from '../e2e/helpers';

async function openPanel(page, name) {
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  await expect(page.locator('#settings-panel-title')).toContainText(name);
}

test.describe('Quality and size settings', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await resetApp(page);
    await uploadWithPicker(page, FIXTURE_PATHS.jpg);
  });

  test('quality and size panels render and persist settings', async ({ page }, testInfo) => {
    await openPanel(page, 'Quality');
    const qualitySlider = page.locator('#quality-slider');
    await expect(qualitySlider).toHaveValue('85');
    await qualitySlider.fill('95');
    await expect(page.locator('.preview-value')).toContainText('KB');
    await saveScreenshot(page, testInfo, 'quality-panel');
    await page.getByRole('button', { name: /Close panel/i }).click();

    await openPanel(page, 'Size');
    const widthSlider = page.locator('#width-slider');
    await widthSlider.fill('800');
    await expect(page.locator('#height-slider')).not.toHaveValue('0');
    await page.locator('.checkbox-row input').uncheck();
    await saveScreenshot(page, testInfo, 'size-panel');

    await page.reload();
    await expect(page.locator('#settings-panel-title')).toContainText('Size');
    await expect(page.locator('#width-slider')).toHaveValue('800');
    await expect(page.locator('.checkbox-row input')).not.toBeChecked();

    const stored = await page.evaluate(() => ({
      quality: localStorage.getItem('image-converter.quality'),
      width: localStorage.getItem('image-converter.width'),
      height: localStorage.getItem('image-converter.height'),
      keepAspectRatio: localStorage.getItem('image-converter.keepAspectRatio'),
    }));

    expect(stored.quality).toBe('95');
    expect(stored.width).toBe('800');
    expect(stored.height).not.toBeNull();
    expect(stored.keepAspectRatio).toBe('false');
  });
});
