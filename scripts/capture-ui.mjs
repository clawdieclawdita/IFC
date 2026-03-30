import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://192.168.1.200:4446', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'artifacts/menu-centered.png', fullPage: true });
await page.locator('.menu-bar').screenshot({ path: 'artifacts/menu-bar-closeup.png' });
await browser.close();
