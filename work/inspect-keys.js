const XLSX = require('../.browserdeps/node_modules/xlsx');
const fs = require('fs');

const buffer = fs.readFileSync('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
const sheet = workbook.Sheets['总库存情况'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

console.log('=== All products with their keys ===');
for (let i = 3; i < rows.length; i++) {
  const row = rows[i] || [];
  const name = String(row[3] || '');
  const barcode = String(row[0] || '');
  if (!name && !barcode) continue;
  // Current key generation
  const parts = [barcode, row[9], row[9], row[9], name, row[4]].map(p => String(p||'').trim().toLowerCase().replace(/\s+/g,'')).filter(Boolean);
  const key = parts.join('|');
  console.log(`Row ${i+1}: barcode=${barcode}, name=${name.substring(0,30)}, spec=${row[4]}, key=${key.substring(0,80)}`);
}
