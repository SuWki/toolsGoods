const { chromium } = require('../.browserdeps/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const chromePath = possiblePaths();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath || undefined });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  
  await page.goto('file:///d:/codex/codex/toolsGoods/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  
  // Read the xlsx file and list all sheet names
  const result = await page.evaluate(async () => {
    const XLSX = window.XLSX;
    const JSZip = window.JSZip;
    
    // Read the file
    const response = await fetch('file:///d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
    
    const sheetNames = workbook.SheetNames;
    const result = { sheetNames, sheets: {} };
    
    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      // Get first 5 rows to see headers
      result.sheets[name] = {
        rowCount: rows.length,
        firstRows: rows.slice(0, 5).map(r => r.slice(0, 20)),
      };
    }
    
    return result;
  });
  
  console.log(JSON.stringify(result, null, 2));
  
  await browser.close();
})();

function possiblePaths() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\wyl\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
