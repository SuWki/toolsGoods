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
  
  // 在页面加载前注入调试脚本
  await page.addInitScript(() => {
    // 保存原始函数
    const originalRenderMatrixTab = window.renderMatrixTab;
    
    // 重写函数以添加调试
    Object.defineProperty(window, 'renderMatrixTab', {
      get() {
        return function(model) {
          console.log('DEBUG renderMatrixTab:', {
            matrixFilteredRowsLength: model.matrixFilteredRows?.length,
            kpiFilter: 'checking...'
          });
          return originalRenderMatrixTab(model);
        };
      },
      set() {}
    });
  });
  
  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  
  page.on('console', msg => {
    if (msg.text().includes('DEBUG')) {
      console.log('PAGE:', msg.text());
    }
  });
  
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);
  
  const fileInput = await page.locator('#matrix-empty-input');
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
    await page.waitForTimeout(5000);
  }
  
  console.log('\n点击卖不完风险筛选...');
  await page.click('[data-kpi-filter="selloutRisk"]');
  await page.waitForTimeout(2000);
  
  await browser.close();
})();
