import path from "path";
import xlsx from "xlsx";

export default function handler(req, res) {
  const { rank } = req.query;

  const filePath = path.join(process.cwd(), "api", "data", "pitch.xlsx");
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const pitches = rows
    .filter(r => String(r.Rank) === rank)
    .map(r => String(r.Pitch));

  res.json([...new Set(pitches)]);
}
