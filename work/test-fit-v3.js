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

  // Check before fit
  const before = await page.evaluate(() => {
    const grid = document.getElementById('matrix-grid');
    const panel = document.getElementById('matrix-panel');
    if (!grid || !panel) return null;
    const gridRect = grid.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      gridHeight: Math.round(gridRect.height),
      gridTop: Math.round(gridRect.top),
      panelHeight: Math.round(panelRect.height),
      viewportHeight: window.innerHeight,
      panelTransform: panel.style.transform,
      gridTransform: grid.style.transform,
    };
  });
  console.log('Before fit:', JSON.stringify(before, null, 2));

  // Click fit screen button
  await page.click('button[data-matrix-fit-screen]');
  await page.waitForTimeout(500);

  // Check after fit
  const after = await page.evaluate(() => {
    const grid = document.getElementById('matrix-grid');
    const panel = document.getElementById('matrix-panel');
    if (!grid || !panel) return null;
    const gridRect = grid.getBoundingClientRect();
    return {
      gridHeight: Math.round(gridRect.height),
      gridTop: Math.round(gridRect.top),
      gridBottom: Math.round(gridRect.bottom),
      viewportHeight: window.innerHeight,
      panelTransform: panel.style.transform,
      gridTransform: grid.style.transform,
      // Check if grid fills the remaining viewport
      gridFillsViewport: gridRect.bottom <= window.innerHeight && gridRect.top < 200,
    };
  });
  console.log('After fit:', JSON.stringify(after, null, 2));

  // The key question: is the grid scaled up or down?
  const scaleMatch = after?.gridTransform?.match(/scale\(([\d.]+)\)/);
  const scale = scaleMatch ? parseFloat(scaleMatch[1]) : null;
  console.log('\nScale value:', scale);
  console.log('Grid original height:', before.gridHeight);
  console.log('Grid scaled height:', after.gridHeight);
  console.log('Viewport height:', after.viewportHeight);
  console.log('Grid top (offset from viewport top):', after.gridTop);
  console.log('Available height:', after.viewportHeight - after.gridTop - 20);
  console.log('Expected scale:', (after.viewportHeight - after.gridTop - 20) / before.gridHeight);
  
  if (scale !== null) {
    console.log('\n=== Result ===');
    if (scale > 1) {
      console.log('STRETCHED UP (放大) ✅');
    } else if (scale < 1) {
      console.log('SHRUNK DOWN (缩小) - grid was taller than available space');
    } else {
      console.log('NO CHANGE (1.0)');
    }
    console.log('Grid bottom within viewport:', after.gridBottom <= after.viewportHeight);
  }

  await page.screenshot({ path: 'work/test-fit-v3.png', fullPage: false });
  console.log('Screenshot saved');

  await browser.close();
})();
