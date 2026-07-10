const { chromium } = require('../.browserdeps/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const chromePath = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\wyl\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  ].find(p => fs.existsSync(p));

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('console', msg => console.log('CONSOLE:', msg.text()));

  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  
  // 切换到九宫格模式
  await page.click('[data-mode="matrix"]');
  await page.waitForTimeout(800);
  
  // 上传文件
  await page.locator('#matrix-empty-input').setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
  await page.waitForTimeout(4000);
  
  // 获取第一个商品的key和名称
  const firstProduct = await page.evaluate(() => {
    const chip = document.querySelector('[data-matrix-jump]');
    if (chip) {
      return {
        key: chip.dataset.matrixJump,
        name: chip.querySelector('small')?.textContent || 'unknown'
      };
    }
    return null;
  });
  
  console.log('First product in matrix:', firstProduct);
  
  if (!firstProduct) {
    console.log('No products found in matrix');
    await browser.close();
    return;
  }
  
  // 滚动到联动总表
  await page.evaluate(() => {
    const linkedTable = document.querySelector('[data-linked-table]');
    if (linkedTable) linkedTable.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(500);
  
  // 获取联动总表中相同key的品名链接
  const linkedRow = await page.evaluate((key) => {
    const link = document.querySelector(`.link-to-matrix[data-link-key="${key}"]`);
    if (link) {
      return {
        key: link.dataset.linkKey,
        name: link.textContent.trim()
      };
    }
    return null;
  }, firstProduct.key);
  
  console.log('Linked row with same key:', linkedRow);
  
  // 点击联动总表中的品名
  const linkSelector = `.link-to-matrix[data-link-key="${firstProduct.key}"]`;
  const linkExists = await page.locator(linkSelector).count() > 0;
  
  if (linkExists) {
    console.log('Clicking on link with key:', firstProduct.key);
    await page.click(linkSelector);
    await page.waitForTimeout(2000);
    
    // 检查是否高亮了对应的商品格子
    const highlightResult = await page.evaluate((key) => {
      const chip = document.querySelector(`[data-matrix-jump="${key}"]`);
      if (chip) {
        return {
          found: true,
          hasFlashClass: chip.classList.contains('chip-flash'),
          parentCellHasFlash: chip.closest('[data-matrix-big-cell]')?.classList.contains('cell-flash') || false,
          rect: chip.getBoundingClientRect()
        };
      }
      return { found: false };
    }, firstProduct.key);
    
    console.log('Highlight result:', highlightResult);
  } else {
    console.log('Link not found for key:', firstProduct.key);
    
    // 列出所有可用的link-key
    const allKeys = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.link-to-matrix')).map(el => ({
        key: el.dataset.linkKey,
        name: el.textContent.trim()
      }));
    });
    console.log('Available links:', allKeys.slice(0, 5));
  }
  
  await page.screenshot({ path: 'work/test-link-highlight-result.png', fullPage: false });
  console.log('Screenshot saved');

  await browser.close();
})();
