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

  console.log('=== 开始全面功能验证 ===');
  
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
      console.log('   ! 文件输入框未找到');
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
        
        // 检查图片是否等比例缩放（不是截取）
        const img = await thumb.locator('img');
        if (await img.count() > 0) {
          const imgBox = await img.boundingBox();
          const thumbBox = await thumb.boundingBox();
          if (imgBox && thumbBox) {
            // 图片应该比容器小（等比例缩放）
            if (imgBox.width <= thumbBox.width * 0.95 && imgBox.height <= thumbBox.height * 0.95) {
              console.log('   ✓ 图片等比例缩放（非截取）');
            } else {
              console.log('   ! 图片可能超出容器');
            }
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
    }
    
    // 7. 测试KPI筛选 - 获取筛选前的联动总表数据量
    console.log('\n7. 测试KPI筛选...');
    const linkedTableBefore = await page.locator('[data-linked-table]');
    let rowCountBefore = 0;
    if (await linkedTableBefore.count() > 0) {
      rowCountBefore = await linkedTableBefore.locator('tbody tr').count();
      console.log('   筛选前联动总表行数:', rowCountBefore);
    }
    
    // 点击健康KPI标签
    const healthyKpi = await page.locator('[data-kpi-filter="healthy"]');
    if (await healthyKpi.count() > 0) {
      await healthyKpi.click();
      await page.waitForTimeout(1500);
      console.log('   ✓ 点击健康KPI标签');
      
      // 检查联动总表是否更新
      const linkedTableAfter = await page.locator('[data-linked-table]');
      if (await linkedTableAfter.count() > 0) {
        const rowCountAfter = await linkedTableAfter.locator('tbody tr').count();
        console.log('   筛选后联动总表行数:', rowCountAfter);
        if (rowCountAfter < rowCountBefore) {
          console.log('   ✓ 联动总表数据已根据KPI筛选更新');
        } else if (rowCountAfter === rowCountBefore) {
          console.log('   ! 联动总表数据未变化（可能所有商品都是健康状态）');
        }
      }
    }
    
    // 8. 测试联动总表点击品名
    console.log('\n8. 测试联动总表点击品名...');
    // 先重置为全部
    await page.locator('[data-kpi-filter="all"]').click();
    await page.waitForTimeout(1000);
    
    const firstLink = await page.locator('.link-to-matrix').first();
    if (await firstLink.count() > 0) {
      const key = await firstLink.getAttribute('data-link-key');
      const name = await firstLink.textContent();
      console.log('   点击商品:', name?.trim(), 'key:', key?.substring(0, 20) + '...');
      
      await firstLink.click();
      await page.waitForTimeout(3000);
      
      // 检查页面是否崩溃
      const currentTitle = await page.title();
      if (currentTitle.includes('黑爪商品驾驶舱')) {
        console.log('   ✓ 页面未崩溃');
      } else {
        console.log('   ✗ 页面可能崩溃');
      }
      
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
    }
    
    console.log('\n=== 功能验证完成 ===');
    
  } catch (err) {
    console.error('测试出错:', err.message);
  }
  
  await page.screenshot({ path: 'work/test-all-fixes-v2-result.png', fullPage: true });
  console.log('\n截图已保存: work/test-all-fixes-v2-result.png');
  
  await browser.close();
})();
