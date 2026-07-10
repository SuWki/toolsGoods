const XLSX = require('../.browserdeps/node_modules/xlsx');
const fs = require('fs');

const buffer = fs.readFileSync('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });

console.log('Sheet names:', workbook.SheetNames);

for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  if (!sheet || !sheet['!ref']) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  console.log(`\n=== Sheet: ${name} (${rows.length} rows) ===`);
  // Show first 5 rows, first 25 cols
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] || [];
    const cells = [];
    for (let j = 0; j < Math.min(25, row.length); j++) {
      cells.push(`[${j+1}]${row[j]}`);
    }
    console.log(`Row ${i+1}: ${cells.join(' | ')}`);
  }
}
