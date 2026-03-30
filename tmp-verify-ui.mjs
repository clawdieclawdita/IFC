import { chromium } from '@playwright/test';
import fs from 'fs/promises';

const url = 'http://192.168.1.200:4444';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: 'artifacts/menu-local-check.png', fullPage: true });
const bodyText = await page.locator('body').innerText();
const badgeText = await page.locator('.offline-badge').innerText().catch(() => 'MISSING');
const menuToggleCount = await page.locator('.menu-toggle').count().catch(() => -1);
const menuItemsCount = await page.locator('.menu-item').count().catch(() => -1);
const html = await page.content();
await fs.writeFile('artifacts/menu-local-check.txt', [
  `URL: ${url}`,
  `badgeText: ${badgeText}`,
  `menuToggleCount: ${menuToggleCount}`,
  `menuItemsCount: ${menuItemsCount}`,
  '--- BODY TEXT ---',
  bodyText,
  '--- HTML SNIPPET ---',
  html.slice(0, 5000),
].join('\n'));
await browser.close();
