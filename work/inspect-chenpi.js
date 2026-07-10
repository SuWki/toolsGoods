const XLSX = require('../.browserdeps/node_modules/xlsx');
const fs = require('fs');

const buffer = fs.readFileSync('d:/codex/codex/toolsGoods/小宝用 九宫格示例1.xlsx');
const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
const sheet = workbook.Sheets['总库存情况'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

// Find all rows with "陈皮" in the name
console.log('=== All 陈皮 products ===');
for (let i = 3; i < rows.length; i++) {
  const row = rows[i] || [];
  const name = String(row[3] || '');
  if (name.includes('陈皮')) {
    console.log(`Row ${i+1}: barcode=${row[0]}, name=${name}, spec=${row[4]}, sku=${row[9]}`);
    // Generate the key the same way the code does
    const key = [row[0], row[9], row[9], row[9], name, row[4]].filter(Boolean).join('|');
    console.log(`  -> key: ${key}`);
  }
}

// Also check if there are products with same barcode
console.log('\n=== Check for duplicate barcodes ===');
const barcodeMap = {};
for (let i = 3; i < rows.length; i++) {
  const row = rows[i] || [];
  if (!row[0]) continue;
  if (!barcodeMap[row[0]]) barcodeMap[row[0]] = [];
  barcodeMap[row[0]].push({ row: i+1, name: row[3], spec: row[4] });
}
Object.entries(barcodeMap).forEach(([barcode, items]) => {
  if (items.length > 1) {
    console.log(`Duplicate barcode ${barcode}:`, items);
  }
});
