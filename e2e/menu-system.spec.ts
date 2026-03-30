import { test, expect } from '@playwright/test';
import { gotoApp, resetApp, saveScreenshot } from './helpers';

test.describe('Menu system', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await resetApp(page);
  });

  test('menu bar starts expanded, can collapse, and state persists on refresh', async ({ page }, testInfo) => {
    const menuBar = page.locator('.menu-bar');
    const toggle = page.locator('.menu-toggle');
    const settingsButton = page.getByRole('button', { name: /Settings/i }).nth(0);

    await expect(menuBar).toHaveClass(/expanded/);
    const expandedInnerHeight = await page.locator('.menu-bar__inner').evaluate((node) => getComputedStyle(node).minHeight);
    expect(expandedInnerHeight).toBe('32px');

    await toggle.click();
    await expect(menuBar).toHaveClass(/collapsed/);
    const collapsedHeight = await menuBar.evaluate((node) => getComputedStyle(node).minHeight);
    expect(collapsedHeight).toBe('16px');

    await toggle.click();
    await expect(menuBar).toHaveClass(/expanded/);

    await settingsButton.click();
    await expect(page.locator('.settings-panel__dialog')).toBeVisible();
    await expect(page.locator('#settings-panel-title')).toContainText('Settings');
    await saveScreenshot(page, testInfo, 'panel-open');

    await page.locator('.settings-panel__backdrop').click({ force: true });
    await expect(page.locator('.settings-panel__dialog')).toBeHidden();

    await page.getByRole('button', { name: /Quality/i }).click();
    await expect(page.locator('#settings-panel-title')).toContainText('Quality');
    await page.reload();

    await expect(page.locator('.menu-bar')).toHaveClass(/expanded/);
    await expect(page.locator('#settings-panel-title')).toContainText('Quality');

    await page.getByRole('button', { name: /Close panel/i }).click();
    await expect(page.locator('.settings-panel__dialog')).toBeHidden();
    await saveScreenshot(page, testInfo, 'menu-persisted');
  });
});
