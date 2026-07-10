const XLSX = require('../.browserdeps/node_modules/xlsx');
const fs = require('fs');

const buffer = fs.readFileSync('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });

const sheet = workbook.Sheets['总库存情况'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

// Show header row (row 3) with column letters
console.log('=== Header row (row 3) ===');
const header = rows[2] || [];
for (let i = 0; i < header.length; i++) {
  const colLetter = XLSX.utils.encode_col(i);
  console.log(`Col ${i+1} (${colLetter}): ${header[i]}`);
}

// Show a few data rows
console.log('\n=== Data rows 4-8 (first 15 cols) ===');
for (let i = 3; i < Math.min(8, rows.length); i++) {
  const row = rows[i] || [];
  const cells = [];
  for (let j = 0; j < Math.min(15, row.length); j++) {
    cells.push(`[${j+1}]${row[j]}`);
  }
  console.log(`Row ${i+1}: ${cells.join(' | ')}`);
}

// Check for sales month columns (24-30 = X-AD)
console.log('\n=== Sales columns (cols 24-30) for rows 4-8 ===');
for (let i = 3; i < Math.min(8, rows.length); i++) {
  const row = rows[i] || [];
  const cells = [];
  for (let j = 23; j < Math.min(30, row.length); j++) {
    cells.push(`[${j+1}]${row[j]}`);
  }
  console.log(`Row ${i+1}: ${cells.join(' | ')}`);
}
