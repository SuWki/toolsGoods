const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', '九宫格数据源 0630.xlsx');
const wb = XLSX.readFile(filePath, { cellDates: true, raw: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

const output = [];

// Print header (row 3, index 2)
output.push('=== Header (row 3) ===');
const header = sheetRows[2] || [];
for (let c = 0; c < Math.min(30, header.length); c++) {
  if (header[c]) output.push(`col${c+1}(${String.fromCharCode(64+c+1)}) = ${header[c]}`);
}

// Find "不知春" and products with 0 sales
output.push('\n=== 不知春 related rows ===');
for (let i = 3; i < sheetRows.length; i++) {
  const r = sheetRows[i] || [];
  const name = String(r[3] || '');
  if (name.includes('不知春')) {
    output.push(`Row${i+1}: name=${name}`);
    output.push(`  barcode=${r[0]}, sku=${r[4]}, spec=${r[5]}`);
    output.push(`  M(13)即时库存=${r[12]}, N(14)日销系数=${r[13]}, O(15)库存月=${r[14]}, P(16)剩余天数=${r[15]}`);
    output.push(`  U(21)线上月均=${r[20]}, X(24)线下月均=${r[23]}`);
    output.push(`  AA(27)库存判断=${r[26]}, AB(28)销量趋势=${r[27]}`);
  }
}

// Find products with 0 sales (线上月均=0 AND 线下月均=0)
output.push('\n=== Products with 0 monthly average sales ===');
let zeroCount = 0;
for (let i = 3; i < sheetRows.length; i++) {
  const r = sheetRows[i] || [];
  const name = String(r[3] || '');
  if (!name) continue;
  const onlineAvg = Number(r[20]) || 0;
  const offlineAvg = Number(r[23]) || 0;
  const monthlyAvg = onlineAvg + offlineAvg;
  if (monthlyAvg === 0) {
    zeroCount++;
    if (zeroCount <= 10) {
      output.push(`Row${i+1}: name=${name}`);
      output.push(`  M(13)即时库存=${r[12]}, N(14)日销系数=${r[13]}, O(15)库存月=${r[14]}, P(16)剩余天数=${r[15]}`);
      output.push(`  U(21)线上月均=${r[20]}, X(24)线下月均=${r[23]}`);
    }
  }
}
output.push(`Total zero-sales products: ${zeroCount}`);

// Check distribution of stockMonths (O column)
output.push('\n=== Stock months distribution ===');
const monthDist = {};
for (let i = 3; i < sheetRows.length; i++) {
  const r = sheetRows[i] || [];
  const name = String(r[3] || '');
  if (!name) continue;
  const stockMonths = r[14];
  const key = stockMonths === "" || stockMonths === null || stockMonths === undefined ? "empty" : String(stockMonths);
  monthDist[key] = (monthDist[key] || 0) + 1;
}
output.push(JSON.stringify(monthDist, null, 2));

// Check distribution of dailySalesCoef (N column)
output.push('\n=== Daily sales coef (N col) distribution ===');
const coefDist = {};
for (let i = 3; i < sheetRows.length; i++) {
  const r = sheetRows[i] || [];
  const name = String(r[3] || '');
  if (!name) continue;
  const coef = r[13];
  const key = coef === "" || coef === null || coef === undefined ? "empty" : String(coef);
  coefDist[key] = (coefDist[key] || 0) + 1;
}
output.push(JSON.stringify(coefDist, null, 2));

// Check all products with low sales but low stock (should be in <=360 days category)
output.push('\n=== Low sales (N<5) but stock>0 products ===');
let lowCount = 0;
for (let i = 3; i < sheetRows.length; i++) {
  const r = sheetRows[i] || [];
  const name = String(r[3] || '');
  if (!name) continue;
  const stock = Number(r[12]) || 0;
  const coef = Number(r[13]) || 0;
  const stockMonths = Number(r[14]) || 0;
  if (stock > 0 && coef < 5 && stockMonths <= 12) {
    lowCount++;
    if (lowCount <= 15) {
      output.push(`Row${i+1}: name=${name}, stock=${stock}, N=${coef}, O=${stockMonths}`);
    }
  }
}
output.push(`Total: ${lowCount}`);

fs.writeFileSync(path.join(__dirname, 'analyze-output.txt'), output.join('\n'));
console.log('Done!');
