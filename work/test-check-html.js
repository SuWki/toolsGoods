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
  
  // 获取联动总表的HTML
  const getLinkedTableInfo = async () => {
    const table = await page.locator('[data-linked-table]');
    const html = await table.innerHTML();
    const rowCount = (html.match(/<tr/g) || []).length;
    const previewText = await page.locator('.block-head .badge.neutral').last().textContent();
    return { rowCount, previewText };
  };
  
  console.log('=== 检查联动总表 ===');
  
  // 全部
  await page.click('[data-kpi-filter="all"]');
  await page.waitForTimeout(1000);
  const allInfo = await getLinkedTableInfo();
  console.log('全部:', allInfo);
  
  // 卖不完风险
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(1000);
  const riskInfo = await getLinkedTableInfo();
  console.log('卖不完风险:', riskInfo);
  
  await browser.close();
})();
