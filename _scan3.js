const fs = require("fs");
let out = [];
try {
  const XLSX = require("xlsx");
  out.push("xlsx loaded");
  const filePath = "D:/toolsGoods/趋势图数据源 0630.xlsx";
  out.push("file exists: " + fs.existsSync(filePath));
  const buffer = fs.readFileSync(filePath);
  out.push("buffer len: " + buffer.length);
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  out.push("=== SheetNames ===");
  out.push(JSON.stringify(wb.SheetNames, null, 2));

  wb.SheetNames.forEach((name) => {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
    out.push("\n========================================");
    out.push("Sheet: " + name + "  rows: " + rows.length);
    const headers = rows[0] || [];
    out.push("--- headers (index: value) ---");
    headers.forEach((h, i) => {
      out.push(i + " : " + JSON.stringify(h));
    });
    out.push("--- first 5 data rows ---");
    for (let r = 1; r <= Math.min(5, rows.length - 1); r++) {
      out.push("row " + r + " : " + JSON.stringify(rows[r]));
    }
  });
} catch (e) {
  out.push("ERROR: " + (e && e.stack ? e.stack : String(e)));
}
fs.writeFileSync("D:/toolsGoods/_scan_result.txt", out.join("\n"), "utf8");
process.exit(0);
