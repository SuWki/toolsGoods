// 验证新的九宫格分类逻辑
const XLSX = require('xlsx');
const path = require('path');

function getDigestionSum(sellOutDays) {
  if (sellOutDays === null || sellOutDays === undefined || Number.isNaN(sellOutDays)) return 6;
  if (sellOutDays <= 90) return 2;
  if (sellOutDays <= 180) return 3;
  if (sellOutDays <= 360) return 4;
  if (sellOutDays <= 720) return 5;
  return 6;
}

function maybeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function assignMatrixCoefficients(rows, periodDays) {
  rows.forEach((row) => {
    if (row.stockMonths !== null && row.stockMonths !== undefined && !Number.isNaN(row.stockMonths)) {
      row.sellOutDays = row.stockMonths * 30;
    } else if (row.sellOutDays !== null && row.sellOutDays !== undefined) {
      // keep existing
    } else if (row.salesQty > 0) {
      row.sellOutDays = (row.stockQty / row.salesQty) * periodDays;
    } else {
      row.sellOutDays = Infinity;
    }
    row.digestionSum = getDigestionSum(row.sellOutDays);
  });

  rows.forEach((row) => {
    const n = (row.dailySalesCoef != null && !Number.isNaN(row.dailySalesCoef)) ? row.dailySalesCoef : 0;
    let x;
    if (n >= 10) { x = 1; }
    else if (n >= 3) { x = 2; }
    else { x = 3; }
    var sum = row.digestionSum;
    var minX = Math.max(1, sum - 3);
    var maxX = Math.min(3, sum - 1);
    x = Math.max(minX, Math.min(maxX, x));
    row.salesCoef = x;
    row.inventoryCoef = sum - x;
  });
}

var filePath = path.join(__dirname, '..', '九宫格数据源 0630.xlsx');
var wb = XLSX.readFile(filePath, { cellDates: true, raw: true });
var ws = wb.Sheets[wb.SheetNames[0]];
var sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

var periodMonths = 7;
var periodDays = periodMonths * 30;
var rows = [];

for (var rowIdx = 3; rowIdx < sheetRows.length; rowIdx++) {
  var r = sheetRows[rowIdx] || [];
  var productName = String(r[3] || "").trim();
  var barcode = String(r[0] || "").trim();
  var sku = String(r[4] || "").trim();
  if (!productName && !barcode && !sku) continue;

  var currentStock = Number(r[12]) || 0;
  var dailySalesCoef = maybeNumber(r[13]);
  var stockMonths = maybeNumber(r[14]);
  var remainingDays = maybeNumber(r[15]);
  var onlineMonthlyAvg = Number(r[20]) || 0;
  var offlineMonthlyAvg = Number(r[23]) || 0;
  var monthlyAverage = onlineMonthlyAvg + offlineMonthlyAvg;
  var salesQty = Math.round(monthlyAverage * periodMonths);

  var derivedStockMonths = stockMonths !== null && stockMonths !== undefined
    ? stockMonths
    : (monthlyAverage > 0 ? currentStock / monthlyAverage : null);

  var sellOutDays = (stockMonths !== null && stockMonths !== undefined)
    ? stockMonths * 30
    : (monthlyAverage > 0 ? (currentStock / monthlyAverage) * 30 : Infinity);

  rows.push({
    key: barcode || sku,
    productName: productName,
    stockQty: currentStock,
    stockMonths: derivedStockMonths,
    remainingDays: remainingDays,
    dailySalesCoef: dailySalesCoef,
    salesQty: salesQty,
    sellOutDays: sellOutDays,
    canSellBeforeExpiry: sellOutDays !== null && remainingDays !== null ? sellOutDays <= remainingDays : null,
  });
}

var filtered = rows.filter(function(r) { return r.stockQty > 0; });
assignMatrixCoefficients(filtered, periodDays);

// 验证1: 不知春香氛织物喷雾
var bzczp = filtered.find(function(r) { return r.productName.indexOf('不知春香氛织物喷雾') >= 0; });
console.log('=== 不知春香氛织物喷雾 ===');
console.log('stockQty:', bzczp.stockQty, 'N:', bzczp.dailySalesCoef, 'O:', bzczp.stockMonths);
console.log('sellOutDays:', bzczp.sellOutDays === Infinity ? 'Infinity' : bzczp.sellOutDays);
console.log('digestionSum:', bzczp.digestionSum, '(expect 6, >720days)');
console.log('salesCoef(X):', bzczp.salesCoef, 'inventoryCoef(Y):', bzczp.inventoryCoef);
console.log('canSellBeforeExpiry:', bzczp.canSellBeforeExpiry, '(expect false)');
console.log('cell: (' + bzczp.salesCoef + ',' + bzczp.inventoryCoef + ') = 折价/去库存');

// 验证2: 低销售商品分布
console.log('\n=== Low N (0<N<3) distribution ===');
var lowN = filtered.filter(function(r) { return r.dailySalesCoef != null && r.dailySalesCoef < 3 && r.dailySalesCoef > 0; });
var cellDist = {};
lowN.forEach(function(r) {
  var cell = '(' + r.salesCoef + ',' + r.inventoryCoef + ')';
  cellDist[cell] = (cellDist[cell] || 0) + 1;
});
console.log('Cell distribution:', JSON.stringify(cellDist, null, 2));
console.log('Total low-N products:', lowN.length);

// 验证3: 格子(3,1) - 低日销+快消化
var cell31 = lowN.filter(function(r) { return r.salesCoef === 3 && r.inventoryCoef === 1; });
console.log('\n=== Cell (3,1) 原价/不补 - low N, fast digestion <=360d ===');
console.log('Count:', cell31.length);
cell31.slice(0, 5).forEach(function(r) {
  var sd = r.sellOutDays === Infinity ? 'Inf' : Math.round(r.sellOutDays);
  console.log('  ' + r.productName + ': N=' + (r.dailySalesCoef ? r.dailySalesCoef.toFixed(2) : 'null') + ', O=' + (r.stockMonths ? r.stockMonths.toFixed(2) : 'null') + ', sellOutDays=' + sd);
});

// 验证4: 各格子统计
console.log('\n=== Grid cell counts ===');
var gridOrder = [
  [1,1], [2,1], [3,1],
  [1,2], [2,2], [3,2],
  [1,3], [2,3], [3,3],
];
var cellMeta = {
  '1|1': '原价/补货', '2|1': '原价/关注', '3|1': '原价/不补',
  '1|2': '原价/关注', '2|2': '原价/不补', '3|2': '压力/消化',
  '1|3': '原价/不补', '2|3': '浮动/消化', '3|3': '折价/去库存',
};
gridOrder.forEach(function(g) {
  var x = g[0], y = g[1];
  var count = filtered.filter(function(r) { return r.salesCoef === x && r.inventoryCoef === y; }).length;
  var key = x + '|' + y;
  console.log('  (' + x + ',' + y + ') ' + cellMeta[key] + ': ' + count + ' products');
});

// 验证5: 消化周期分类
console.log('\n=== Digestion cycle distribution ===');
var sumDist = {};
filtered.forEach(function(r) { sumDist[r.digestionSum] = (sumDist[r.digestionSum] || 0) + 1; });
Object.keys(sumDist).sort().forEach(function(sum) {
  var label = { '2': '<=90d', '3': '<=180d', '4': '<=360d', '5': '<=720d', '6': '>720d' }[sum];
  console.log('  sum=' + sum + ' (' + label + '): ' + sumDist[sum] + ' products');
});

console.log('\nDone!');
