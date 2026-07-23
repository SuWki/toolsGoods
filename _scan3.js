const fs = require("fs");
const XLSX = require("xlsx");
let out;
try {
  const wb = XLSX.readFile("D:/toolsGoods/趋势图数据源 0630.xlsx", { cellDates: true, raw: true, sheetRows: 5 });
  out = "SheetNames: " + JSON.stringify(wb.SheetNames) + "\n";
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    out += "\n=== Sheet: " + sn + " | rows(sample): " + rows.length + " ===\n";
    const headers = rows[0] || [];
    out += "Header count: " + headers.length + "\n";
    for (let i = 0; i < headers.length; i++) {
      out += "  col[" + i + "] = " + JSON.stringify(headers[i]) + "\n";
    }
    out += "--- first 3 data rows ---\n";
    for (let r = 1; r <= Math.min(3, rows.length - 1); r++) {
      const row = rows[r];
      const parts = [];
      for (let c = 0; c < Math.min(row.length, headers.length); c++) {
        if (row[c] !== "" && row[c] != null) parts.push("[" + c + "]=" + JSON.stringify(row[c]));
      }
      out += "row" + r + ": " + parts.join(" | ") + "\n";
    }
  }
} catch (e) {
  out = "ERROR: " + (e && e.stack ? e.stack : String(e));
}
fs.writeFileSync("D:/toolsGoods/_scan_result.txt", out, "utf8");
