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
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[ERROR] ${msg.text().substring(0, 300)}`);
  });

  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Switch to matrix tab and upload
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);
  const fileInput = page.locator('#matrix-empty-input');
  await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
  await page.waitForTimeout(4000);

  // Step 1: Click a product image in the grid to jump to linked table
  const jumpInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll('[data-matrix-jump]');
    if (!btns.length) return { count: 0 };
    const first = btns[0];
    // Find which cell it belongs to
    const cell = first.closest('[data-matrix-big-cell]');
    return { 
      count: btns.length, 
      key: first.dataset.matrixJump, 
      text: first.textContent.trim().substring(0, 30),
      cellKey: cell ? cell.dataset.matrixBigCell : null,
    };
  });
  console.log('Step 1 - Product to test:', JSON.stringify(jumpInfo));

  // Click the product chip to go to linked table
  await page.evaluate((key) => {
    const btn = document.querySelector(`[data-matrix-jump="${key}"]`);
    if (btn) btn.click();
  }, jumpInfo.key);
  await page.waitForTimeout(1500);

  // Check focused row in linked table
  const focusedRow = await page.evaluate(() => {
    const row = document.querySelector('.focus-row');
    if (!row) return null;
    const cells = Array.from(row.querySelectorAll('td'));
    return { name: cells[0]?.textContent.trim().substring(0, 40) };
  });
  console.log('Step 2 - Focused row after grid->table:', JSON.stringify(focusedRow));

  // Step 3: Click the link-to-matrix in the linked table
  const linkInfo = await page.evaluate(() => {
    const link = document.querySelector('.link-to-matrix');
    if (!link) return null;
    return { key: link.dataset.linkKey, text: link.textContent.trim().substring(0, 40) };
  });
  console.log('Step 3 - Link found:', JSON.stringify(linkInfo));

  if (linkInfo) {
    await page.evaluate(() => {
      const link = document.querySelector('.link-to-matrix');
      if (link) link.click();
    });
    await page.waitForTimeout(1500);

    // Check if the correct cell is highlighted (has cell-flash class)
    const flashResult = await page.evaluate((key) => {
      const cells = document.querySelectorAll('[data-matrix-big-cell]');
      let targetCell = null;
      let targetChip = null;
      let flashCell = null;
      let flashChip = null;
      cells.forEach((cell) => {
        const chip = cell.querySelector(`[data-matrix-jump="${key}"]`);
        if (chip) {
          targetCell = cell;
          targetChip = chip;
          if (cell.classList.contains('cell-flash')) flashCell = cell.dataset.matrixBigCell;
          if (chip.classList.contains('chip-flash')) flashChip = true;
        }
      });
      // Also check if any cell has cell-flash
      const allFlashCells = Array.from(document.querySelectorAll('.cell-flash')).map(c => c.dataset.matrixBigCell);
      return {
        targetCellFound: !!targetCell,
        targetCellKey: targetCell ? targetCell.dataset.matrixBigCell : null,
        targetChipFound: !!targetChip,
        cellFlashActive: !!flashCell,
        chipFlashActive: !!flashChip,
        allFlashCells,
      };
    }, linkInfo.key);
    console.log('Step 4 - Flash result:', JSON.stringify(flashResult, null, 2));

    // Check scroll position - should be centered on the cell, not at top
    const scrollResult = await page.evaluate((key) => {
      const cells = document.querySelectorAll('[data-matrix-big-cell]');
      let targetCell = null;
      cells.forEach((cell) => {
        const chip = cell.querySelector(`[data-matrix-jump="${key}"]`);
        if (chip) targetCell = cell;
      });
      if (!targetCell) return null;
      const rect = targetCell.getBoundingClientRect();
      return { 
        cellTop: Math.round(rect.top), 
        cellBottom: Math.round(rect.bottom), 
        viewportHeight: window.innerHeight,
        isCentered: rect.top > 0 && rect.top < window.innerHeight * 0.6,
      };
    }, linkInfo.key);
    console.log('Step 5 - Cell scroll position:', JSON.stringify(scrollResult));
    
    // Take a screenshot to see the highlight
    await page.screenshot({ path: 'work/test-highlight-cell.png' });
    console.log('Screenshot saved: work/test-highlight-cell.png');
  }

  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
})();
