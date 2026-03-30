import { test, expect } from '@playwright/test';
import {
  FIXTURE_PATHS,
  collectAnimationMetrics,
  convertImages,
  gotoApp,
  resetApp,
  saveScreenshot,
  setTargetFormat,
  uploadWithPicker,
  waitForConversionDone,
  writeJsonArtifact,
} from './helpers';

test.describe('Animation quality', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await resetApp(page);
  });

  test('swipe animation appears, moves left-to-right, and completes near the intended timing', async ({ page }, testInfo) => {
    await uploadWithPicker(page, [FIXTURE_PATHS.jpg]);
    await setTargetFormat(page, 'png');

    const metricsPromise = collectAnimationMetrics(page);
    await convertImages(page);

    await expect(page.locator('.swipe-overlay__card')).toBeVisible();
    const animationName = await page.locator('.swipe-overlay__card').evaluate((node) => getComputedStyle(node).animationName);
    const animationDuration = await page.locator('.swipe-overlay__card').evaluate((node) => getComputedStyle(node).animationDuration);
    const animationTiming = await page.locator('.swipe-overlay__card').evaluate((node) => getComputedStyle(node).animationTimingFunction);

    const metrics = await metricsPromise;
    await waitForConversionDone(page, 1);

    expect(animationName).toContain('swipe-right');
    expect(animationDuration).toBe('1.2s');
    expect(metrics.visibleSamples).toBeGreaterThan(5);
    expect(metrics.durationMs).toBeGreaterThan(900);
    expect(metrics.durationMs).toBeLessThan(1400);
    expect(metrics.negativeSteps).toBe(0);

    await writeJsonArtifact('animation-metrics.json', {
      animationName,
      animationDuration,
      animationTiming,
      metrics,
    });
    await saveScreenshot(page, testInfo, 'animation-complete');
  });
});
