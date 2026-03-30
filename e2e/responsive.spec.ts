import { test, expect } from '@playwright/test';
import { FIXTURE_PATHS, getBounding, gotoApp, resetApp, saveScreenshot, uploadWithPicker } from './helpers';

const viewports = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'tablet', width: 1100, height: 1180 },
  { name: 'mobile-820', width: 820, height: 1180 },
  { name: 'mobile-640', width: 640, height: 1180 },
];

test.describe('Responsive layout', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} layout remains usable`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoApp(page);
      await resetApp(page);
      await uploadWithPicker(page, [FIXTURE_PATHS.jpg, FIXTURE_PATHS.webp, FIXTURE_PATHS.gif]);

      const inputBox = await getBounding(page, '.split-layout__column--input');
      const outputBox = await getBounding(page, '.split-layout__column--output');
      const railBox = await getBounding(page, '.split-layout__rail--bottom');

      if (viewport.width > 1100) {
        expect(Math.abs(inputBox.y - outputBox.y)).toBeLessThan(24);
        expect(outputBox.x).toBeGreaterThan(inputBox.x);
      } else {
        expect(outputBox.y).toBeGreaterThan(inputBox.y);
      }

      expect(railBox.y).toBeGreaterThan(outputBox.y - 5);
      await expect(page.locator('.upload-panel .image-card')).toHaveCount(3);
      await expect(page.locator('.convert-button')).toBeVisible();
      await saveScreenshot(page, testInfo, viewport.name);
    });
  }
});
