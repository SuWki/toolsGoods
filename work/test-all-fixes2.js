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

  // Switch to matrix tab first
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);

  // Upload the file via matrix-empty-input
  const fileInput = page.locator('#matrix-empty-input');
  await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
  await page.waitForTimeout(4000);

  // Check the page state via DOM
  const headers = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const results = [];
    for (const t of tables) {
      const ths = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
      results.push(ths);
    }
    return results;
  });
  console.log('\n=== All table headers ===');
  headers.forEach((h, i) => console.log(`Table ${i}:`, h));

  // === TEST 1 & 2: Check 规格 and 生产备注 columns ===
  const linkedTableHeaders = headers.find(h => h.includes('品名') && h.includes('条码') && h.includes('保质期'));
  console.log('\n=== TEST 1: 规格 column ===');
  console.log('Linked table headers:', linkedTableHeaders);
  if (linkedTableHeaders) {
    console.log('规格 found:', linkedTableHeaders.includes('规格'));
    console.log('规格 position (should be after 品名):', linkedTableHeaders.indexOf('品名') + 1 === linkedTableHeaders.indexOf('规格'));
    
    console.log('\n=== TEST 2: 生产备注 column ===');
    console.log('生产备注 found:', linkedTableHeaders.includes('生产备注'));
    const smIdx = linkedTableHeaders.indexOf('库存月');
    const pnIdx = linkedTableHeaders.indexOf('生产备注');
    const expIdx = linkedTableHeaders.indexOf('保质期');
    console.log(`库存月 index: ${smIdx}, 生产备注 index: ${pnIdx}, 保质期 index: ${expIdx}`);
    console.log('生产备注 between 库存月 and 保质期:', pnIdx === smIdx + 1 && expIdx === pnIdx + 1);
  }

  // === TEST 3: Check 保质期 calculation ===
  const expiryData = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    for (const t of tables) {
      const ths = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (ths.includes('保质期') && ths.includes('规格') && ths.includes('生产备注')) {
        const expiryIdx = ths.indexOf('保质期');
        const specIdx = ths.indexOf('规格');
        const nameIdx = ths.indexOf('品名');
        const prodNoteIdx = ths.indexOf('生产备注');
        const rows = Array.from(t.querySelectorAll('tbody tr')).slice(0, 5);
        return rows.map(r => {
          const cells = Array.from(r.querySelectorAll('td'));
          return {
            name: cells[nameIdx]?.textContent.trim().substring(0, 30),
            spec: cells[specIdx]?.textContent.trim(),
            prodNote: cells[prodNoteIdx]?.textContent.trim(),
            expiry: cells[expiryIdx]?.textContent.trim(),
          };
        });
      }
    }
    return null;
  });
  console.log('\n=== TEST 3: 保质期 calculation ===');
  console.log('Sample data:', JSON.stringify(expiryData, null, 2));
  console.log('Expected: 1494/365 =', (1494/365).toFixed(1), '年');

  // === TEST 4: Check sales period auto-read ===
  const salesPeriodText = await page.evaluate(() => {
    const toolbar = document.querySelector('.matrix-toolbar');
    return toolbar ? toolbar.textContent.trim() : null;
  });
  console.log('\n=== TEST 4: Sales period auto-read ===');
  console.log('Toolbar text:', salesPeriodText);
  const dateInputCount = await page.evaluate(() => {
    return document.querySelectorAll('.matrix-toolbar input[type="date"]').length;
  });
  console.log('Date inputs count (should be 0):', dateInputCount);

  // === TEST 5: Test 适应屏幕 (fit screen stretch) ===
  console.log('\n=== TEST 5: 适应屏幕 stretch ===');
  const beforeFit = await page.evaluate(() => {
    const panel = document.getElementById('matrix-panel');
    if (!panel) return null;
    return { transform: panel.style.transform, height: panel.getBoundingClientRect().height };
  });
  console.log('Before fit:', JSON.stringify(beforeFit));
  
  await page.click('button[data-matrix-fit-screen]');
  await page.waitForTimeout(500);
  const afterFit = await page.evaluate(() => {
    const panel = document.getElementById('matrix-panel');
    if (!panel) return null;
    return { transform: panel.style.transform, height: panel.getBoundingClientRect().height, viewportHeight: window.innerHeight };
  });
  console.log('After fit:', JSON.stringify(afterFit));
  const scaleMatch = afterFit?.transform?.match(/scale\(([\d.]+)\)/);
  const scale = scaleMatch ? parseFloat(scaleMatch[1]) : null;
  console.log('Scale value:', scale);
  console.log('Scale >= 1 (stretching up, not shrinking):', scale !== null && scale >= 1);
  // Reset
  await page.click('button[data-matrix-fit-screen]');
  await page.waitForTimeout(300);

  // === TEST 6: Bidirectional linking ===
  console.log('\n=== TEST 6: Bidirectional linking ===');
  
  // First, click a product in the matrix grid to jump to linked table
  const jumpInfo = await page.evaluate(() => {
    const btns = document.querySelectorAll('[data-matrix-jump]');
    if (!btns.length) return { count: 0 };
    const first = btns[0];
    return { count: btns.length, key: first.dataset.matrixJump, text: first.textContent.trim().substring(0, 30) };
  });
  console.log('Jump buttons count:', jumpInfo.count);
  console.log('First jump button:', JSON.stringify(jumpInfo));
  
  if (jumpInfo.key) {
    // Click the jump button
    await page.evaluate((key) => {
      const btn = document.querySelector(`[data-matrix-jump="${key}"]`);
      if (btn) btn.click();
    }, jumpInfo.key);
    await page.waitForTimeout(1500);

    // Check focused row
    const focusedRow = await page.evaluate(() => {
      const row = document.querySelector('.focus-row');
      if (!row) return null;
      const cells = Array.from(row.querySelectorAll('td'));
      return { name: cells[0]?.textContent.trim().substring(0, 40) };
    });
    console.log('Focused row after matrix->table:', JSON.stringify(focusedRow));

    // Now click the link-to-matrix to jump back
    const linkInfo = await page.evaluate(() => {
      const link = document.querySelector('.link-to-matrix');
      if (!link) return null;
      return { key: link.dataset.linkKey, text: link.textContent.trim().substring(0, 40) };
    });
    console.log('Link-to-matrix found:', JSON.stringify(linkInfo));

    if (linkInfo) {
      await page.evaluate(() => {
        const link = document.querySelector('.link-to-matrix');
        if (link) link.click();
      });
      await page.waitForTimeout(1500);

      // Check if we're scrolled to the matrix panel
      const matrixVisible = await page.evaluate(() => {
        const panel = document.getElementById('matrix-panel');
        if (!panel) return { found: false };
        const rect = panel.getBoundingClientRect();
        return { found: true, top: rect.top, bottom: rect.bottom, visible: rect.top < 200 };
      });
      console.log('Matrix panel after table->matrix:', JSON.stringify(matrixVisible));
    }
  }

  await page.screenshot({ path: 'work/test-final.png', fullPage: true });
  console.log('\nFinal screenshot saved');

  await browser.close();
  console.log('\n=== ALL TESTS COMPLETE ===');
})();
