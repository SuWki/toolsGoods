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
  page.on('crash', () => console.log('PAGE CRASHED!'));

  console.log('=== 最终功能验证 ===');
  
  try {
    // 1. 加载页面
    console.log('\n1. 加载页面...');
    await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    console.log('   ✓ 页面加载成功');
    
    // 2. 检查标题
    const title = await page.title();
    console.log('   标题:', title);
    console.log('   ✓ 标题正确:', title.includes('黑爪商品驾驶舱'));
    
    // 3. 切换到九宫格模式
    console.log('\n2. 切换到九宫格模式...');
    await page.click('[data-mode="matrix"]');
    await page.waitForTimeout(800);
    console.log('   ✓ 切换到九宫格模式');
    
    // 4. 上传文件
    console.log('\n3. 上传九宫格文件...');
    const fileInput = await page.locator('#matrix-empty-input');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
      await page.waitForTimeout(5000);
      console.log('   ✓ 文件上传成功');
    }
    
    // 5. 检查九宫格渲染
    console.log('\n4. 检查九宫格渲染...');
    const matrixGrid = await page.locator('#matrix-grid');
    console.log('   ✓ 九宫格已渲染:', await matrixGrid.count() > 0);
    
    // 检查商品格子是否为正方形
    const chip = await page.locator('.sku-chip').first();
    if (await chip.count() > 0) {
      const thumb = await chip.locator('.sku-thumb');
      const box = await thumb.boundingBox();
      if (box) {
        const ratio = box.width / box.height;
        console.log('   商品图片尺寸:', box.width.toFixed(0), 'x', box.height.toFixed(0), '比例:', ratio.toFixed(2));
        console.log('   ✓ 商品格子接近正方形:', Math.abs(ratio - 1) < 0.1);
      }
    }
    
    // 6. 检查KPI筛选功能
    console.log('\n5. 检查KPI筛选功能...');
    
    const getRowCount = async () => {
      const table = await page.locator('[data-linked-table]');
      return await table.locator('tbody tr').count();
    };
    
    // 全部
    await page.click('[data-kpi-filter="all"]');
    await page.waitForTimeout(1000);
    const allRows = await getRowCount();
    console.log('   全部 - 联动总表行数:', allRows);
    
    // 卖不完风险
    await page.click('[data-kpi-filter="selloutRisk"]');
    await page.waitForTimeout(1000);
    const riskRows = await getRowCount();
    console.log('   卖不完风险 - 联动总表行数:', riskRows);
    
    // 可卖完
    await page.click('[data-kpi-filter="selloutSafe"]');
    await page.waitForTimeout(1000);
    const safeRows = await getRowCount();
    console.log('   可卖完 - 联动总表行数:', safeRows);
    
    // 验证
    if (riskRows < allRows && safeRows < allRows && riskRows + safeRows === allRows) {
      console.log('   ✓ KPI筛选功能正常');
    } else {
      console.log('   ! KPI筛选可能有问题');
    }
    
    // 7. 检查卖不完商品红色显示
    console.log('\n6. 检查卖不完商品红色显示...');
    const selloutRiskChips = await page.locator('.sellout-risk').count();
    console.log('   卖不完风险商品数量:', selloutRiskChips);
    console.log('   ✓ 卖不完商品已标记:', selloutRiskChips > 0);
    
    // 8. 测试点击品名（不崩溃）
    console.log('\n7. 测试点击品名...');
    await page.click('[data-kpi-filter="all"]');
    await page.waitForTimeout(1000);
    
    const firstLink = await page.locator('.link-to-matrix').first();
    if (await firstLink.count() > 0) {
      await firstLink.click();
      await page.waitForTimeout(2000);
      
      // 检查页面是否崩溃
      const currentTitle = await page.title();
      console.log('   ✓ 页面未崩溃:', currentTitle.includes('黑爪商品驾驶舱'));
    }
    
    // 9. 检查横轴标签
    console.log('\n8. 检查横轴标签...');
    const rowHeads = await page.locator('.matrix-row-head').allTextContents();
    const hasInventoryDepth = rowHeads.some(t => t.includes('库存深度'));
    console.log('   横轴标签:', rowHeads);
    console.log('   ✓ 横轴标签包含"库存深度":', hasInventoryDepth);
    
    console.log('\n=== 所有功能验证完成 ===');
    
  } catch (err) {
    console.error('测试出错:', err.message);
  }
  
  await page.screenshot({ path: 'work/test-final-validation-result.png', fullPage: true });
  console.log('\n截图已保存: work/test-final-validation-result.png');
  
  await browser.close();
})();
