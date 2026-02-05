const XLSX = require("xlsx");
const path = require("path");

module.exports = (req, res) => {
  const { rank } = req.query;

  const filePath = path.join(process.cwd(), "api", "data", "pitch.xlsx");
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const pitches = rows
    .filter(r => String(r.Rank) === rank)
    .map(r => String(r.Pitch));

  res.json([...new Set(pitches)]);
};
