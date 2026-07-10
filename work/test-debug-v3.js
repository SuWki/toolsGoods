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
  
  // 注入调试代码
  await page.addInitScript(() => {
    window.debugInfo = {};
    // 拦截renderLinkedTab函数
    const originalRenderLinkedTab = window.renderLinkedTab;
    if (originalRenderLinkedTab) {
      window.renderLinkedTab = function(model) {
        window.debugInfo.lastModel = {
          linkedRowsLength: model.linkedRows?.length,
          matrixFilteredRowsLength: model.matrixFilteredRows?.length,
          matrixFilteredRowsKeys: model.matrixFilteredRows?.map(r => r.key),
        };
        return originalRenderLinkedTab(model);
      };
    }
  });
  
  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);
  
  const fileInput = await page.locator('#matrix-empty-input');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
    await page.waitForTimeout(5000);
  }
  
  // 点击卖不完风险
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(1500);
  
  // 获取调试信息
  const debugInfo = await page.evaluate(() => window.debugInfo);
  console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));
  
  await browser.close();
})();
