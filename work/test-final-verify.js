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
  
  // 获取联动总表行数函数
  const getRowCount = async () => {
    const table = await page.locator('[data-linked-table]');
    return await table.locator('tbody tr').count();
  };
  
  // 获取九宫格商品数量
  const getMatrixSkuCount = async () => {
    const text = await page.locator('.matrix-kpis .matrix-mini.active strong').first().textContent();
    return parseInt(text) || 0;
  };
  
  console.log('=== 验证KPI筛选 ===');
  
  // 全部
  await page.click('[data-kpi-filter="all"]');
  await page.waitForTimeout(1000);
  const allRows = await getRowCount();
  const allSku = await getMatrixSkuCount();
  console.log(`全部: 联动总表${allRows}行, 九宫格${allSku}个SKU`);
  
  // 卖不完风险
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(1000);
  const riskRows = await getRowCount();
  const riskSku = await getMatrixSkuCount();
  console.log(`卖不完风险: 联动总表${riskRows}行, 九宫格${riskSku}个SKU`);
  
  // 可卖完
  await page.click('[data-kpi-filter="selloutSafe"]');
  await page.waitForTimeout(1000);
  const safeRows = await getRowCount();
  const safeSku = await getMatrixSkuCount();
  console.log(`可卖完: 联动总表${safeRows}行, 九宫格${safeSku}个SKU`);
  
  // 验证
  if (riskRows < allRows && riskSku < allSku) {
    console.log('\n✓ KPI筛选功能正常: 卖不完风险筛选后数据量减少');
  } else {
    console.log('\n✗ KPI筛选可能有问题');
  }
  
  if (safeRows + riskRows === allRows) {
    console.log('✓ 可卖完 + 卖不完风险 = 全部，数据一致');
  }
  
  await browser.close();
})();
