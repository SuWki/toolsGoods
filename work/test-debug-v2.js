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
  
  // 检查KPI标签的active状态
  const checkActive = async (label) => {
    const el = await page.locator(`[data-kpi-filter="${label}"]`);
    const className = await el.getAttribute('class');
    console.log(`KPI ${label} class:`, className);
  };
  
  console.log('=== 初始状态 ===');
  await checkActive('all');
  await checkActive('selloutRisk');
  
  // 获取联动总表行数
  const getRowCount = async () => {
    const table = await page.locator('[data-linked-table]');
    return await table.locator('tbody tr').count();
  };
  
  console.log('全部行数:', await getRowCount());
  
  // 点击卖不完风险
  console.log('\n=== 点击卖不完风险 ===');
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(1500);
  
  await checkActive('all');
  await checkActive('selloutRisk');
  console.log('筛选后行数:', await getRowCount());
  
  // 检查卖不完风险商品数量
  const selloutRiskCount = await page.locator('.sellout-risk').count();
  console.log('页面上卖不完风险商品数量:', selloutRiskCount);
  
  await browser.close();
})();
