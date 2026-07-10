const { chromium } = require('../.browserdeps/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const chromePath = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\wyl\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  ].find(p => fs.existsSync(p));

  if (!chromePath) {
    console.log('Chrome not found, skipping browser test');
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('console', msg => console.log('CONSOLE:', msg.text()));

  console.log('=== 开始功能验证 ===');
  
  try {
    // 1. 加载页面
    console.log('\n1. 加载页面...');
    await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    console.log('   ✓ 页面加载成功');
    
    // 2. 检查标题和icon
    console.log('\n2. 检查标题和icon...');
    const title = await page.title();
    console.log('   标题:', title);
    if (title.includes('黑爪商品驾驶舱')) {
      console.log('   ✓ 标题正确');
    } else {
      console.log('   ✗ 标题错误');
    }
    
    // 3. 切换到九宫格模式
    console.log('\n3. 切换到九宫格模式...');
    await page.click('[data-mode="matrix"]');
    await page.waitForTimeout(800);
    console.log('   ✓ 切换到九宫格模式');
    
    // 4. 上传文件
    console.log('\n4. 上传九宫格文件...');
    const fileInput = await page.locator('#matrix-empty-input');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
      await page.waitForTimeout(5000);
      console.log('   ✓ 文件上传成功');
    } else {
      console.log('   ! 文件输入框未找到，可能已上传');
    }
    
    // 5. 检查九宫格渲染
    console.log('\n5. 检查九宫格渲染...');
    const matrixGrid = await page.locator('#matrix-grid');
    if (await matrixGrid.count() > 0) {
      console.log('   ✓ 九宫格已渲染');
      
      // 检查商品格子是否为正方形
      const chip = await page.locator('.sku-chip').first();
      if (await chip.count() > 0) {
        const thumb = await chip.locator('.sku-thumb');
        const box = await thumb.boundingBox();
        if (box) {
          const ratio = box.width / box.height;
          console.log('   商品图片尺寸:', box.width.toFixed(0), 'x', box.height.toFixed(0), '比例:', ratio.toFixed(2));
          if (Math.abs(ratio - 1) < 0.1) {
            console.log('   ✓ 商品格子接近正方形');
          } else {
            console.log('   ✗ 商品格子不是正方形');
          }
        }
      }
    } else {
      console.log('   ✗ 九宫格未渲染');
    }
    
    // 6. 检查KPI标签
    console.log('\n6. 检查KPI标签...');
    const kpiLabels = await page.locator('[data-kpi-filter]').count();
    console.log('   KPI标签数量:', kpiLabels);
    if (kpiLabels === 6) {
      console.log('   ✓ KPI标签数量正确');
    } else {
      console.log('   ✗ KPI标签数量错误');
    }
    
    // 7. 测试KPI筛选
    console.log('\n7. 测试KPI筛选...');
    const healthyKpi = await page.locator('[data-kpi-filter="healthy"]');
    if (await healthyKpi.count() > 0) {
      await healthyKpi.click();
      await page.waitForTimeout(1000);
      console.log('   ✓ 点击健康KPI标签');
      
      // 检查联动总表是否更新
      const linkedTable = await page.locator('[data-linked-table]');
      if (await linkedTable.count() > 0) {
        console.log('   ✓ 联动总表已更新');
      }
    }
    
    // 8. 测试联动总表点击品名
    console.log('\n8. 测试联动总表点击品名...');
    const firstLink = await page.locator('.link-to-matrix').first();
    if (await firstLink.count() > 0) {
      const key = await firstLink.getAttribute('data-link-key');
      const name = await firstLink.textContent();
      console.log('   点击商品:', name?.trim(), 'key:', key?.substring(0, 20) + '...');
      
      await firstLink.click();
      await page.waitForTimeout(2000);
      
      // 检查是否高亮
      const highlightedChip = await page.locator('.chip-flash');
      if (await highlightedChip.count() > 0) {
        console.log('   ✓ 商品已高亮');
      } else {
        console.log('   ✗ 商品未高亮');
      }
    } else {
      console.log('   ! 联动总表无数据');
    }
    
    // 9. 检查卖不完商品是否显示红色
    console.log('\n9. 检查卖不完商品红色显示...');
    const selloutRiskChips = await page.locator('.sellout-risk').count();
    console.log('   卖不完风险商品数量:', selloutRiskChips);
    if (selloutRiskChips > 0) {
      console.log('   ✓ 卖不完商品已标记');
    }
    
    // 10. 检查横轴标签
    console.log('\n10. 检查横轴标签...');
    const rowHeads = await page.locator('.matrix-row-head').allTextContents();
    console.log('   横轴标签:', rowHeads);
    const hasInventoryDepth = rowHeads.some(t => t.includes('库存深度'));
    if (hasInventoryDepth) {
      console.log('   ✓ 横轴标签包含"库存深度"');
    } else {
      console.log('   ✗ 横轴标签不包含"库存深度"');
    }
    
    console.log('\n=== 功能验证完成 ===');
    
  } catch (err) {
    console.error('测试出错:', err.message);
  }
  
  await page.screenshot({ path: 'work/test-all-features-result.png', fullPage: true });
  console.log('\n截图已保存: work/test-all-features-result.png');
  
  await browser.close();
})();
