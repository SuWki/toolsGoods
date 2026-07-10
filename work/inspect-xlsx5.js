const XLSX = require('../.browserdeps/node_modules/xlsx');
const fs = require('fs');

const buffer = fs.readFileSync('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });

const sheet = workbook.Sheets['总库存情况'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

// Show all rows with remaining days data, showing all relevant cols
console.log('=== All data rows with remaining days ===');
for (let i = 3; i < rows.length; i++) {
  const row = rows[i] || [];
  if (!row[0] && !row[3]) continue;
  // Check if remainingDays differs between rows
  const rd = row[12];
  console.log(`Row ${i+1}: barcode=${row[0]}, name=${String(row[3]).substring(0,30)}, remainingDays=${rd}, spec=${row[4]}, prodNote=${row[6]}`);
}

// The user says "数据源-批次，F列条码和K列可用库存和S列剩余有效天数"
// But this file only has one sheet "总库存情况"
// F=6=分类, K=11=即时库存, S=19=3月库存售罄率
// The user might be referring to the "总库存情况" sheet with different column mapping
// Let me check: maybe remaining days is actually col 13 (M) = 剩余天数
// and the user is talking about a different file structure

// Check all column headers again to see which one has remaining days
console.log('\n=== All headers ===');
const header = rows[2] || [];
for (let i = 0; i < header.length; i++) {
  if (header[i]) console.log(`Col ${i+1} (${XLSX.utils.encode_col(i)}): ${header[i]}`);
}
