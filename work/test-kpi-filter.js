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
  
  page.on('console', msg => console.log('CONSOLE:', msg.text()));

  console.log('=== 测试KPI筛选功能 ===');
  
  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);
  
  const fileInput = await page.locator('#matrix-empty-input');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
    await page.waitForTimeout(5000);
  }
  
  // 获取全部数据量
  const linkedTable = await page.locator('[data-linked-table]');
  const totalRows = await linkedTable.locator('tbody tr').count();
  console.log('全部商品数量:', totalRows);
  
  // 测试各种KPI筛选
  const filters = [
    { name: '健康', selector: '[data-kpi-filter="healthy"]' },
    { name: '风险', selector: '[data-kpi-filter="risk"]' },
    { name: '积压', selector: '[data-kpi-filter="backlog"]' },
    { name: '可卖完', selector: '[data-kpi-filter="selloutSafe"]' },
    { name: '卖不完风险', selector: '[data-kpi-filter="selloutRisk"]' },
  ];
  
  for (const filter of filters) {
    const btn = await page.locator(filter.selector);
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(1500);
      const count = await linkedTable.locator('tbody tr').count();
      console.log(`${filter.name}筛选后数量:`, count);
    }
  }
  
  // 恢复全部
  await page.locator('[data-kpi-filter="all"]').click();
  await page.waitForTimeout(1000);
  
  console.log('\n=== 测试完成 ===');
  
  await page.screenshot({ path: 'work/test-kpi-filter-result.png', fullPage: true });
  await browser.close();
})();
