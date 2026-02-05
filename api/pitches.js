import xlsx from "xlsx";
import path from "path";

export default function handler(req, res) {
  const { rank } = req.query;

  const filePath = path.join(process.cwd(), "pitch.xlsx");
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  const pitches = data
    .filter(r => String(r.Rank) === rank)
    .map(r => String(r.Pitch));

  res.json([...new Set(pitches)]);
}
