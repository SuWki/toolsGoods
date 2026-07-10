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
    if (msg.type() === 'error') console.log(`[ERROR] ${msg.text()}`);
  });

  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Upload the matrix workbook file
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
  await page.waitForTimeout(3000);

  // Check if we're in matrix mode
  const activeTab = await page.evaluate(() => window.state?.activeTab);
  console.log('Active tab:', activeTab);

  // Take screenshot of the matrix view
  await page.screenshot({ path: 'work/test-1-matrix-overview.png', fullPage: true });
  console.log('Screenshot 1 saved');

  // === TEST 1: Check 规格 column exists in linked table ===
  const headers = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    for (const t of tables) {
      const ths = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (ths.includes('规格')) return ths;
    }
    return null;
  });
  console.log('\n=== TEST 1: 规格 column ===');
  console.log('Headers:', headers);
  console.log('规格 column found:', headers && headers.includes('规格'));
  console.log('规格 is between 品名 and 条码:', headers && headers.indexOf('规格') === headers.indexOf('品名') + 1);

  // === TEST 2: Check 生产备注 column exists ===
  console.log('\n=== TEST 2: 生产备注 column ===');
  console.log('生产备注 found:', headers && headers.includes('生产备注'));
  console.log('生产备注 is between 库存月 and 保质期:', headers && headers.indexOf('生产备注') === headers.indexOf('库存月') + 1 && headers.indexOf('保质期') === headers.indexOf('生产备注') + 1);

  // === TEST 3: Check 保质期 calculation ===
  const expiryData = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    for (const t of tables) {
      const ths = Array.from(t.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (ths.includes('保质期') && ths.includes('规格')) {
        const expiryIdx = ths.indexOf('保质期');
        const specIdx = ths.indexOf('规格');
        const nameIdx = ths.indexOf('品名');
        const rows = Array.from(t.querySelectorAll('tbody tr')).slice(0, 5);
        return rows.map(r => {
          const cells = Array.from(r.querySelectorAll('td'));
          return {
            name: cells[nameIdx]?.textContent.trim().substring(0, 30),
            spec: cells[specIdx]?.textContent.trim(),
            expiry: cells[expiryIdx]?.textContent.trim(),
          };
        });
      }
    }
    return null;
  });
  console.log('\n=== TEST 3: 保质期 calculation ===');
  console.log('Sample data:', JSON.stringify(expiryData, null, 2));
  // remainingDays = 1494, 1494/365 = 4.1 years
  console.log('Expected: 1494/365 =', (1494/365).toFixed(1), '年');

  // === TEST 4: Check sales period is auto-read ===
  const salesPeriodText = await page.evaluate(() => {
    const toolbar = document.querySelector('.matrix-toolbar');
    return toolbar ? toolbar.textContent.trim() : null;
  });
  console.log('\n=== TEST 4: Sales period auto-read ===');
  console.log('Toolbar text:', salesPeriodText);
  console.log('Contains 2026/1/1:', salesPeriodText && salesPeriodText.includes('2026-01-01'));
  console.log('Contains 2026/6/30:', salesPeriodText && salesPeriodText.includes('2026-06-30'));
  
  // Check no date inputs
  const dateInputs = await page.evaluate(() => {
    return document.querySelectorAll('.matrix-toolbar input[type="date"]').length;
  });
  console.log('Date inputs count (should be 0):', dateInputs);

  // === TEST 5: Test 适应屏幕 (fit screen stretch) ===
  console.log('\n=== TEST 5: 适应屏幕 stretch ===');
  // Click the fit screen button
  await page.click('button[data-matrix-fit-screen]');
  await page.waitForTimeout(500);
  const fitResult = await page.evaluate(() => {
    const panel = document.getElementById('matrix-panel');
    const transform = panel.style.transform;
    const rect = panel.getBoundingClientRect();
    return { transform, height: rect.height, viewportHeight: window.innerHeight };
  });
  console.log('Fit result:', JSON.stringify(fitResult));
  // Scale should be >= 1
  const scaleMatch = fitResult.transform.match(/scale\(([\d.]+)\)/);
  const scale = scaleMatch ? parseFloat(scaleMatch[1]) : null;
  console.log('Scale value:', scale);
  console.log('Scale >= 1 (stretching up):', scale !== null && scale >= 1);
  // Reset
  await page.click('button[data-matrix-fit-screen]');
  await page.waitForTimeout(300);

  // === TEST 6: Test bidirectional linking ===
  console.log('\n=== TEST 6: Bidirectional linking ===');
  // Click a product image in the matrix grid to jump to linked table
  const jumpResult = await page.evaluate(() => {
    const jumpBtn = document.querySelector('[data-matrix-jump]');
    if (!jumpBtn) return { error: 'No jump button found' };
    return { key: jumpBtn.dataset.matrixJump, text: jumpBtn.textContent.trim().substring(0, 30) };
  });
  console.log('Matrix jump button:', JSON.stringify(jumpResult));
  
  if (jumpResult.key) {
    await page.click(`[data-matrix-jump="${jumpResult.key}"]`);
    await page.waitForTimeout(1000);
    
    // Check if we're scrolled to the linked table
    const focusedRow = await page.evaluate(() => {
      const row = document.querySelector('.focus-row');
      if (!row) return null;
      const cells = Array.from(row.querySelectorAll('td'));
      const productName = cells[0]?.textContent.trim().substring(0, 40);
      return { productName, isFocused: true };
    });
    console.log('Focused row after matrix->table jump:', JSON.stringify(focusedRow));
    
    // Now click the product name link to jump back to matrix
    const linkExists = await page.evaluate(() => {
      const link = document.querySelector('.link-to-matrix');
      return link ? { key: link.dataset.linkKey, text: link.textContent.trim() } : null;
    });
    console.log('Link to matrix exists:', JSON.stringify(linkExists));
    
    if (linkExists) {
      await page.click('.link-to-matrix');
      await page.waitForTimeout(1000);
      
      // Check if we scrolled back to matrix panel
      const matrixVisible = await page.evaluate(() => {
        const panel = document.getElementById('matrix-panel');
        if (!panel) return false;
        const rect = panel.getBoundingClientRect();
        return rect.top < 100; // Should be near top of viewport
      });
      console.log('Matrix panel visible after table->matrix jump:', matrixVisible);
      
      // Check matrixFocusKey is set
      const focusKey = await page.evaluate(() => window.state?.matrixFocusKey);
      console.log('Matrix focus key set:', focusKey);
    }
  }

  await page.screenshot({ path: 'work/test-6-bidirectional.png', fullPage: false });
  console.log('\nScreenshot saved');

  await browser.close();
  console.log('\n=== ALL TESTS COMPLETE ===');
})();
