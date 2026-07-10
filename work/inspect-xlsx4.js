const XLSX = require('../.browserdeps/node_modules/xlsx');
const fs = require('fs');

const buffer = fs.readFileSync('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });

const sheet = workbook.Sheets['总库存情况'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

// Check columns 59-67 (BG-BO) which contain date headers and production note
console.log('=== Columns 59-67 headers ===');
const header = rows[2] || [];
for (let i = 58; i < Math.min(67, header.length); i++) {
  const colLetter = XLSX.utils.encode_col(i);
  console.log(`Col ${i+1} (${colLetter}): ${header[i]}`);
}

// Check row 1 for date info
console.log('\n=== Row 1 cols 59-67 ===');
const row1 = rows[0] || [];
for (let i = 58; i < Math.min(67, row1.length); i++) {
  console.log(`Col ${i+1}: ${row1[i]}`);
}

// Check row 2 for date info
console.log('\n=== Row 2 cols 59-67 ===');
const row2 = rows[1] || [];
for (let i = 58; i < Math.min(67, row2.length); i++) {
  console.log(`Col ${i+1}: ${row2[i]}`);
}

// Check remainingDays (col 13 / M) for all data rows
console.log('\n=== Remaining days (col 13/M) for all data rows ===');
for (let i = 3; i < Math.min(20, rows.length); i++) {
  const row = rows[i] || [];
  if (!row[0] && !row[3]) continue;
  console.log(`Row ${i+1}: barcode=${row[0]}, name=${row[3]}, remainingDays=${row[12]}, stockQty=${row[10]}, productionNote=${row[6]}`);
}

// Check col 67 (BO) - 生产备注 - to see if it has different data than col 7 (G)
console.log('\n=== Compare col 7 (G) vs col 67 (BO) 生产备注 ===');
for (let i = 3; i < Math.min(10, rows.length); i++) {
  const row = rows[i] || [];
  if (!row[0] && !row[3]) continue;
  console.log(`Row ${i+1}: G=${row[6]}, BO=${row[66]}`);
}
