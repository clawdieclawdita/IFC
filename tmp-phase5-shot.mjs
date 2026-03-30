import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto('http://192.168.1.200:4444', { waitUntil: 'networkidle' });
await page.click('button[title="Privacy"]');
await page.screenshot({ path: 'artifacts/privacy-panel-phase5.png', fullPage: true });
await page.click('.panel-close');
await page.click('button[title="Preserve"]');
await page.screenshot({ path: 'artifacts/filename-panel-phase5.png', fullPage: true });
await browser.close();
