const { chromium } = require('/home/pschivo/mission-control/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const outDir = path.join(process.cwd(), 'test-artifacts/screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  page.on('dialog', async (dialog) => {
    console.log('Dialog:', dialog.message());
    await dialog.dismiss();
  });

  // Test 1: Initial empty UI
  console.log('Testing 1: Initial empty UI');
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, '01-empty-ui.png'), fullPage: true });

  // Test 2: Check split-screen layout
  console.log('Testing 2: Split-screen layout');
  await page.waitForSelector('.content-grid', { timeout: 5000 });
  const gridExists = await page.isVisible('.content-grid');
  console.log('Split-screen grid exists:', gridExists);
  
  // Check if sidebar exists
  const sidebarExists = await page.isVisible('.content-grid__sidebar');
  console.log('Sidebar exists:', sidebarExists);
  
  // Check if main content exists  
  const mainExists = await page.isVisible('.content-grid__main');
  console.log('Main content exists:', mainExists);

  // Test 3: Upload files
  console.log('Testing 3: File upload');
  const fileInput = page.locator('input[type="file"]');
  const sampleFiles = [
    path.join(process.cwd(), 'dist/sample-landscape.svg'),
    path.join(process.cwd(), 'dist/sample-card.svg'),
  ];
  
  await fileInput.setInputFiles(sampleFiles);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '02-uploaded-files.png'), fullPage: true });

  // Check uploaded files
  const uploadedCards = await page.locator('.image-card').count();
  console.log('Uploaded image cards:', uploadedCards);

  // Test 4: Select format
  console.log('Testing 4: Format selection');
  await page.locator('input[value="png"]').check({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '03-format-selected.png'), fullPage: true });

  // Test 5: Convert images
  console.log('Testing 5: Conversion process');
  await page.getByRole('button', { name: 'Convert all images' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '04-converting.png'), fullPage: true });

  // Wait for conversion to complete
  try {
    await page.getByText('Ready to download').first().waitFor({ timeout: 10000 });
    console.log('Conversion completed successfully');
    await page.screenshot({ path: path.join(outDir, '05-converted-results.png'), fullPage: true });
  } catch (error) {
    console.log('Conversion timeout or error:', error.message);
    await page.screenshot({ path: path.join(outDir, '05-conversion-error.png'), fullPage: true });
  }

  // Test 6: Download functionality
  console.log('Testing 6: Download functionality');
  try {
    const [single] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.getByRole('button', { name: 'Download' }).first().click(),
    ]);
    await single.saveAs(path.join(outDir, 'single-download.png'));
    console.log('Single download completed');
  } catch (error) {
    console.log('Single download failed:', error.message);
  }

  try {
    const [zip] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.getByRole('button', { name: 'Download all as ZIP' }).click(),
    ]);
    await zip.saveAs(path.join(outDir, 'all-downloads.zip'));
    console.log('ZIP download completed');
  } catch (error) {
    console.log('ZIP download failed:', error.message);
  }
  
  await page.screenshot({ path: path.join(outDir, '06-download-actions.png'), fullPage: true });

  // Test 7: Clear all functionality
  console.log('Testing 7: Clear all');
  await page.getByRole('button', { name: 'Clear All' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '07-cleared-all.png'), fullPage: true });

  // Test 8: Edge case - upload during conversion (simulate)
  console.log('Testing 8: Edge cases');
  await fileInput.setInputFiles([sampleFiles[0]]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '08-upload-during-idle.png'), fullPage: true });

  await browser.close();
  console.log('Testing completed. Screenshots saved to:', outDir);
})();