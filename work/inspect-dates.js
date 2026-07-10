const XLSX = require('../.browserdeps/node_modules/xlsx');
const fs = require('fs');

const buffer = fs.readFileSync('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
const sheet = workbook.Sheets['总库存情况'];

// Check row 1, cols 59-67
console.log('=== Row 1, cols 59-67 ===');
for (let col = 59; col <= 67; col++) {
  const cellRef = XLSX.utils.encode_cell({ r: 0, c: col - 1 });
  const cell = sheet[cellRef];
  console.log(`Col ${col} (${cellRef}):`, cell ? { v: cell.v, t: cell.t, w: cell.w } : 'empty');
}

// Check row 3 (header), cols 59-67
console.log('\n=== Row 3 (header), cols 59-67 ===');
for (let col = 59; col <= 67; col++) {
  const cellRef = XLSX.utils.encode_cell({ r: 2, c: col - 1 });
  const cell = sheet[cellRef];
  console.log(`Col ${col} (${cellRef}):`, cell ? { v: cell.v, t: cell.t, w: cell.w } : 'empty');
}

// Check sales month columns to determine which months have data
console.log('\n=== Sales data (cols 24-30) for row 4 ===');
for (let col = 24; col <= 30; col++) {
  const cellRef = XLSX.utils.encode_cell({ r: 3, c: col - 1 });
  const cell = sheet[cellRef];
  console.log(`Col ${col} (${cellRef}):`, cell ? cell.v : 'empty');
}
