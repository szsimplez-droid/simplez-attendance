const XLSX = require("xlsx");
const path = require("path");

module.exports = (req, res) => {
  const filePath = path.join(process.cwd(), "api", "data", "pitch.xlsx");
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const ranks = [...new Set(rows.map(r => String(r.Rank)))];
  res.json(ranks);
};
