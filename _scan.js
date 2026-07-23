const XLSX = require('xlsx');
const wb = XLSX.readFile('趋势图数据源 0630.xlsx', { cellDates: true, raw: true });
console.log('Sheets:', wb.SheetNames);
for (const s of wb.SheetNames) {
  const ws = wb.Sheets[s];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  console.log('\n=== Sheet: ' + s + ' === rows: ' + rows.length);
  console.log('Headers:', JSON.stringify(rows[0]));
  if (rows.length > 1) console.log('Row1:', JSON.stringify(rows[1]));
  if (rows.length > 2) console.log('Row2:', JSON.stringify(rows[2]));
  if (rows.length > 3) console.log('Row3:', JSON.stringify(rows[3]));
}
