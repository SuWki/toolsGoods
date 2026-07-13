const XLSX = require('xlsx');
const path = require('path');
const filePath = path.join(__dirname, '..', '九宫格数据源 0630.xlsx');
const wb = XLSX.readFile(filePath, { cellDates: true, raw: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

// Print header row (row 3, index 2) for columns 40-55 (AP~AU+)
const header = sheetRows[2] || [];
console.log('=== Header row 3, columns 40-55 ===');
for (let c = 39; c < Math.min(56, header.length); c++) {
  if (header[c]) {
    var colLetter = '';
    var n = c + 1;
    while (n > 0) {
      var rem = (n - 1) % 26;
      colLetter = String.fromCharCode(65 + rem) + colLetter;
      n = Math.floor((n - 1) / 26);
    }
    console.log('col' + (c+1) + '(' + colLetter + ') = ' + header[c]);
  }
}

// Also print row 1 for same columns
const row1 = sheetRows[0] || [];
console.log('\n=== Row 1, columns 40-55 ===');
for (let c = 39; c < Math.min(56, row1.length); c++) {
  if (row1[c] !== '' && row1[c] !== null && row1[c] !== undefined) {
    var colLetter2 = '';
    var n2 = c + 1;
    while (n2 > 0) {
      var rem2 = (n2 - 1) % 26;
      colLetter2 = String.fromCharCode(65 + rem2) + colLetter2;
      n2 = Math.floor((n2 - 1) / 26);
    }
    console.log('col' + (c+1) + '(' + colLetter2 + ') = ' + row1[c]);
  }
}

// Print row 2
const row2 = sheetRows[1] || [];
console.log('\n=== Row 2, columns 40-55 ===');
for (let c = 39; c < Math.min(56, row2.length); c++) {
  if (row2[c] !== '' && row2[c] !== null && row2[c] !== undefined) {
    var colLetter3 = '';
    var n3 = c + 1;
    while (n3 > 0) {
      var rem3 = (n3 - 1) % 26;
      colLetter3 = String.fromCharCode(65 + rem3) + colLetter3;
      n3 = Math.floor((n3 - 1) / 26);
    }
    console.log('col' + (c+1) + '(' + colLetter3 + ') = ' + row2[c]);
  }
}

// Check data rows for AP~AU columns
console.log('\n=== Sample data rows, AP~AU columns ===');
for (let i = 3; i < Math.min(8, sheetRows.length); i++) {
  var r = sheetRows[i] || [];
  var vals = [];
  for (let c = 41; c < 47; c++) {
    vals.push(r[c] || '');
  }
  console.log('Row' + (i+1) + ' AP~AU: ' + JSON.stringify(vals));
}
