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
  
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('crash', () => console.log('PAGE CRASHED!'));

  console.log('=== 测试点击品名崩溃问题 ===');
  
  try {
    await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // 切换到九宫格模式
    await page.click('[data-mode="matrix"]');
    await page.waitForTimeout(800);
    
    // 上传文件
    const fileInput = await page.locator('#matrix-empty-input');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
      await page.waitForTimeout(5000);
    }
    
    console.log('文件上传完成，准备点击品名...');
    
    // 点击联动总表的第一个品名
    const firstLink = await page.locator('.link-to-matrix').first();
    if (await firstLink.count() > 0) {
      const key = await firstLink.getAttribute('data-link-key');
      const name = await firstLink.textContent();
      console.log('点击商品:', name?.trim(), 'key:', key);
      
      await firstLink.click();
      await page.waitForTimeout(3000);
      
      console.log('点击完成，检查页面状态...');
      
      // 检查页面是否还在
      const title = await page.title();
      console.log('页面标题:', title);
      
      // 检查九宫格是否还在
      const matrixGrid = await page.locator('#matrix-grid');
      console.log('九宫格存在:', await matrixGrid.count() > 0);
    } else {
      console.log('未找到联动总表链接');
    }
    
  } catch (err) {
    console.error('测试出错:', err.message);
  }
  
  await page.screenshot({ path: 'work/test-crash-result.png', fullPage: true });
  console.log('截图已保存');
  
  await browser.close();
})();
