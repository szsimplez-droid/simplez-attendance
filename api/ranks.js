import xlsx from "xlsx";
import path from "path";

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), "pitch.xlsx");
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  const ranks = [...new Set(data.map(r => String(r.Rank)))];
  res.json(ranks);
}
