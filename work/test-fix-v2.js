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
  const fileInput = page.locator('#matrix-empty-input');
  await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
  await page.waitForTimeout(4000);

  // === TEST 1: 库存月四舍五入取整 ===
  const stockMonthData = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    for (const t of tables) {
      const ths = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (ths.includes('库存月') && ths.includes('规格')) {
        const smIdx = ths.indexOf('库存月');
        const nameIdx = ths.indexOf('品名');
        const rows = Array.from(t.querySelectorAll('tbody tr')).slice(0, 5);
        return rows.map(r => {
          const cells = Array.from(r.querySelectorAll('td'));
          return {
            name: cells[nameIdx]?.textContent.trim().substring(0, 30),
            stockMonth: cells[smIdx]?.textContent.trim(),
          };
        });
      }
    }
    return null;
  });
  console.log('=== TEST 1: 库存月四舍五入 ===');
  console.log('Data:', JSON.stringify(stockMonthData, null, 2));
  // Check all values are integers (no decimals)
  if (stockMonthData) {
    const allIntegers = stockMonthData.every(d => {
      const match = d.stockMonth.match(/(\d+)/);
      return !match || !d.stockMonth.includes('.');
    });
    console.log('All integers (no decimals):', allIntegers);
  }

  // === TEST 2: Key以条码为唯一值 ===
  const keyData = await page.evaluate(() => {
    // Get all data-matrix-jump keys from the grid
    const jumpBtns = document.querySelectorAll('[data-matrix-jump]');
    const gridKeys = Array.from(jumpBtns).map(b => b.dataset.matrixJump);
    
    // Get all data-link-key from the linked table
    const linkBtns = document.querySelectorAll('.link-to-matrix');
    const tableKeys = Array.from(linkBtns).map(b => b.dataset.linkKey);
    
    return { gridKeys, tableKeys };
  });
  console.log('\n=== TEST 2: Key以条码为唯一值 ===');
  console.log('Grid keys:', keyData.gridKeys);
  console.log('Table keys:', keyData.tableKeys);
  console.log('Keys are barcodes only (no | separator):', 
    keyData.gridKeys.every(k => !k.includes('|')) && keyData.tableKeys.every(k => !k.includes('|')));

  // === TEST 3: Bidirectional linking still works ===
  console.log('\n=== TEST 3: Bidirectional linking ===');
  
  // Click a product in the grid to go to linked table
  const firstKey = keyData.gridKeys[0];
  if (firstKey) {
    await page.evaluate((key) => {
      const btn = document.querySelector(`[data-matrix-jump="${key}"]`);
      if (btn) btn.click();
    }, firstKey);
    await page.waitForTimeout(1500);
    
    const focusedRow = await page.evaluate(() => {
      const row = document.querySelector('.focus-row');
      if (!row) return null;
      const cells = Array.from(row.querySelectorAll('td'));
      const linkKey = row.querySelector('.link-to-matrix')?.dataset.linkKey;
      return { name: cells[0]?.textContent.trim().substring(0, 40), linkKey };
    });
    console.log('Focused row after grid->table:', JSON.stringify(focusedRow));
    console.log('Link key matches grid key:', focusedRow?.linkKey === firstKey);
    
    // Now click the link to go back
    if (focusedRow?.linkKey) {
      await page.evaluate(() => {
        const link = document.querySelector('.link-to-matrix');
        if (link) link.click();
      });
      await page.waitForTimeout(1500);
      
      const flashResult = await page.evaluate((key) => {
        const cells = document.querySelectorAll('[data-matrix-big-cell]');
        let found = false;
        let flashActive = false;
        cells.forEach((cell) => {
          const chip = cell.querySelector(`[data-matrix-jump="${key}"]`);
          if (chip) {
            found = true;
            if (cell.classList.contains('cell-flash')) flashActive = true;
          }
        });
        return { found, flashActive };
      }, focusedRow.linkKey);
      console.log('Flash result after table->grid:', JSON.stringify(flashResult));
    }
  }

  await browser.close();
  console.log('\n=== ALL TESTS COMPLETE ===');
})();
