const { chromium } = require('../.browserdeps/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const chromePath = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\wyl\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  ].find(p => fs.existsSync(p));

  if (!chromePath) {
    console.log('Chrome not found');
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  
  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);
  
  const fileInput = await page.locator('#matrix-empty-input');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
    await page.waitForTimeout(5000);
  }
  
  // 在页面中执行代码检查rows.length
  const checkRowsLength = async () => {
    return await page.evaluate(() => {
      // 找到tableSection渲染的表格
      const table = document.querySelector('[data-linked-table]');
      if (!table) return { error: 'Table not found' };
      
      const tbody = table.querySelector('tbody');
      if (!tbody) return { error: 'Tbody not found' };
      
      const rows = tbody.querySelectorAll('tr');
      return { 
        rowCount: rows.length,
        previewText: document.querySelector('.block-head .badge.neutral')?.textContent || 'not found'
      };
    });
  };
  
  console.log('=== 检查rows.length ===');
  
  // 全部
  await page.click('[data-kpi-filter="all"]');
  await page.waitForTimeout(1000);
  console.log('全部:', await checkRowsLength());
  
  // 卖不完风险
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(1000);
  console.log('卖不完风险:', await checkRowsLength());
  
  // 检查九宫格中的SKU数量
  const getMatrixSkuCount = async () => {
    return await page.evaluate(() => {
      const activeKpi = document.querySelector('.matrix-mini.active strong');
      return activeKpi ? activeKpi.textContent : 'not found';
    });
  };
  
  console.log('九宫格SKU数量:', await getMatrixSkuCount());
  
  await browser.close();
})();
