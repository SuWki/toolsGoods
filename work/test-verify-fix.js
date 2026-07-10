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
  
  // 获取所有badge文本
  const getAllBadges = async () => {
    return await page.evaluate(() => {
      const badges = document.querySelectorAll('.badge.neutral');
      return Array.from(badges).map(b => b.textContent);
    });
  };
  
  console.log('=== 验证KPI筛选 ===');
  
  // 全部
  await page.click('[data-kpi-filter="all"]');
  await page.waitForTimeout(1000);
  console.log('全部 - 所有badge:', await getAllBadges());
  
  // 卖不完风险
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(1000);
  console.log('卖不完风险 - 所有badge:', await getAllBadges());
  
  // 获取联动总表的badge（应该是第二个）
  const getLinkedTableBadge = async () => {
    return await page.evaluate(() => {
      const linkedTable = document.querySelector('[data-linked-table]');
      if (!linkedTable) return 'not found';
      const badge = linkedTable.querySelector('.badge.neutral');
      return badge ? badge.textContent : 'not found';
    });
  };
  
  console.log('联动总表badge:', await getLinkedTableBadge());
  
  // 获取联动总表行数
  const getLinkedTableRowCount = async () => {
    return await page.evaluate(() => {
      const linkedTable = document.querySelector('[data-linked-table]');
      if (!linkedTable) return 0;
      return linkedTable.querySelectorAll('tbody tr').length;
    });
  };
  
  console.log('联动总表行数:', await getLinkedTableRowCount());
  
  await browser.close();
})();
