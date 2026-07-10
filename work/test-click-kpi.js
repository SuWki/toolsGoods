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
  
  // 获取点击前的状态
  const getState = async () => {
    return await page.evaluate(() => {
      // 检查state是否存在
      return {
        hasState: typeof state !== 'undefined',
        matrixFilters: typeof state !== 'undefined' ? state.matrixFilters : null,
      };
    });
  };
  
  console.log('=== 测试KPI标签点击 ===');
  
  console.log('点击前状态:', await getState());
  
  // 点击卖不完风险
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(1000);
  
  console.log('点击后状态:', await getState());
  
  // 检查active类
  const getActiveKpi = async () => {
    return await page.evaluate(() => {
      const active = document.querySelector('.matrix-mini.active');
      return active ? active.dataset.kpiFilter : 'none';
    });
  };
  
  console.log('当前active KPI:', await getActiveKpi());
  
  await browser.close();
})();
