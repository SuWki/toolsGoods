const { chromium } = require('../.browserdeps/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const chromePath = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\wyl\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  ].find(p => fs.existsSync(p));

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);
  await page.locator('#matrix-empty-input').setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
  await page.waitForTimeout(4000);

  // Get the second product's link key from the linked table
  const tableKeys = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.link-to-matrix')).map(l => ({
      key: l.dataset.linkKey,
      text: l.textContent.trim().substring(0, 30),
    }));
  });
  console.log('Table links:', JSON.stringify(tableKeys));

  // Click the SECOND link (index 1) to test
  const targetKey = tableKeys[1]?.key;
  console.log('\nClicking link with key:', targetKey);

  await page.evaluate((key) => {
    const link = document.querySelector(`.link-to-matrix[data-link-key="${key}"]`);
    if (link) link.click();
  }, targetKey);
  
  // Wait a bit for render + requestAnimationFrame
  await page.waitForTimeout(500);

  // Check flash immediately (animation is 2s, so at 500ms it should be active)
  const flashResult = await page.evaluate((key) => {
    const cells = document.querySelectorAll('[data-matrix-big-cell]');
    let targetCell = null;
    let targetChip = null;
    cells.forEach((cell) => {
      const chip = cell.querySelector(`[data-matrix-jump="${key}"]`);
      if (chip) {
        targetCell = cell;
        targetChip = chip;
      }
    });
    return {
      targetCellFound: !!targetCell,
      targetCellKey: targetCell ? targetCell.dataset.matrixBigCell : null,
      cellFlashActive: targetCell ? targetCell.classList.contains('cell-flash') : false,
      chipFlashActive: targetChip ? targetChip.classList.contains('chip-flash') : false,
    };
  }, targetKey);
  console.log('Flash result (at 500ms):', JSON.stringify(flashResult, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'work/test-flash-v2.png' });
  
  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})();
