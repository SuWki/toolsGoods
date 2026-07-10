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
  
  // 点击全部
  await page.click('[data-kpi-filter="all"]');
  await page.waitForTimeout(1000);
  
  // 检查卖不完风险商品
  const selloutRiskChips = await page.locator('.sellout-risk').count();
  console.log('卖不完风险商品数量(sellout-risk class):', selloutRiskChips);
  
  // 检查红色文字的商品
  const redTextChips = await page.locator('.sku-chip small[style*="color: var(--danger)"]').count();
  console.log('红色文字商品数量:', redTextChips);
  
  // 检查所有商品的能否卖完状态
  const canSellStatuses = await page.locator('.sku-chip').evaluateAll(chips => {
    return chips.map(chip => {
      const small = chip.querySelector('small');
      return {
        name: small?.textContent,
        isRed: small?.style.color.includes('danger') || small?.getAttribute('style')?.includes('danger'),
        classList: chip.className,
      };
    });
  });
  console.log('商品状态:', canSellStatuses);
  
  await browser.close();
})();
