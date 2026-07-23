const path = require('path');
const XLSX = require(path.join(__dirname, 'node_modules', 'xlsx'));
const fs = require('fs');

const filePath = path.join(__dirname, '趋势图数据源 0630.xlsx');
const wb = XLSX.readFile(filePath, { cellDates: true, raw: true });

let out = '';
out += 'Sheets: ' + JSON.stringify(wb.SheetNames) + '\n';

for (const s of wb.SheetNames) {
  const ws = wb.Sheets[s];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  out += '\n=== Sheet: ' + s + ' === rows: ' + rows.length + '\n';
  out += 'Headers: ' + JSON.stringify(rows[0]) + '\n';
  if (rows.length > 1) out += 'Row1: ' + JSON.stringify(rows[1]) + '\n';
  if (rows.length > 2) out += 'Row2: ' + JSON.stringify(rows[2]) + '\n';
  if (rows.length > 3) out += 'Row3: ' + JSON.stringify(rows[3]) + '\n';
}

fs.writeFileSync(path.join(__dirname, '_scan_result.txt'), out, 'utf8');
console.log('Done! Wrote _scan_result.txt');
