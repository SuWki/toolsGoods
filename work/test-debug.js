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
    console.log(`[${msg.type()}] ${msg.text().substring(0, 200)}`);
  });

  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  // Check initial state
  const initialState = await page.evaluate(() => {
    return {
      hasState: typeof window.state !== 'undefined',
      activeTab: window.state?.activeTab,
      sourceKeys: Object.keys(window.state?.sources || {}),
      matrixRows: window.state?.sources?.matrixWorkbook?.rows?.length,
    };
  });
  console.log('Initial state:', JSON.stringify(initialState, null, 2));

  // Find all file inputs
  const fileInputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="file"]');
    return Array.from(inputs).map((inp, i) => ({
      index: i,
      id: inp.id,
      accept: inp.accept,
      parent: inp.closest('[data-source]')?.dataset?.source || inp.closest('label')?.textContent?.trim()?.substring(0, 50),
    }));
  });
  console.log('File inputs:', JSON.stringify(fileInputs, null, 2));

  // Look for the matrix upload button/area
  const uploadAreas = await page.evaluate(() => {
    const buttons = document.querySelectorAll('[data-open-source], [data-source-key]');
    return Array.from(buttons).map(b => ({
      tag: b.tagName,
      text: b.textContent.trim().substring(0, 50),
      dataOpenSource: b.dataset.openSource,
      dataSourceKey: b.dataset.sourceKey,
    }));
  });
  console.log('Upload areas:', JSON.stringify(uploadAreas, null, 2));

  // Check the tab content
  const tabContent = await page.evaluate(() => {
    const el = document.getElementById('tab-content');
    return el ? el.innerHTML.substring(0, 500) : 'NOT FOUND';
  });
  console.log('Tab content (first 500 chars):', tabContent);

  await page.screenshot({ path: 'work/test-initial.png' });
  
  await browser.close();
})();
