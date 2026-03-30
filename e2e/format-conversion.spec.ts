import { test, expect } from '@playwright/test';
import {
  FIXTURE_PATHS,
  convertImages,
  gotoApp,
  resetApp,
  saveScreenshot,
  setTargetFormat,
  uploadWithPicker,
  waitForConversionDone,
  writeJsonArtifact,
} from './helpers';

const conversions = [
  { from: 'jpg', to: 'png', path: FIXTURE_PATHS.jpg, output: 'sample-jpg.png' },
  { from: 'png', to: 'webp', path: FIXTURE_PATHS.png, output: 'sample-png.webp' },
  { from: 'bmp', to: 'jpg', path: FIXTURE_PATHS.bmp, output: 'sample-bmp.jpg' },
  { from: 'tiff', to: 'png', path: FIXTURE_PATHS.tiff, output: 'sample-tiff.png' },
  { from: 'webp', to: 'gif', path: FIXTURE_PATHS.webp, output: 'sample-webp.gif' },
  { from: 'gif', to: 'jpg', path: FIXTURE_PATHS.gif, output: 'sample-gif.jpg' },
  { from: 'svg', to: 'png', path: FIXTURE_PATHS.svg, output: 'sample-svg.png' },
];

test.describe('Format conversion coverage', () => {
  for (const conversion of conversions) {
    test(`${conversion.from.toUpperCase()} -> ${conversion.to.toUpperCase()} converts successfully`, async ({ page }, testInfo) => {
      await gotoApp(page);
      await resetApp(page);
      await setTargetFormat(page, conversion.to);
      await uploadWithPicker(page, [conversion.path]);
      await convertImages(page);
      await waitForConversionDone(page, 1);
      await expect(page.locator('.converted-zone .image-card h4')).toContainText([conversion.output]);
      await expect(page.locator('.converted-zone .pill--success')).toContainText('1 ready');
      await saveScreenshot(page, testInfo, `${conversion.from}-to-${conversion.to}`);
      await writeJsonArtifact(`conversion-${conversion.from}-to-${conversion.to}.json`, conversion);
    });
  }
});
