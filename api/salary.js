const XLSX = require("xlsx");
const path = require("path");

module.exports = (req, res) => {
  const { rank, pitch } = req.query;

  const filePath = path.join(process.cwd(), "api", "data", "pitch.xlsx");
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const row = rows.find(
    r => r.Rank === rank && String(r.Pitch) === String(pitch)
  );

  if (!row) return res.status(404).json({ Salary: 0 });

  res.json({ Salary: Number(row.BasicSalary) });
 };
