import fs from "fs";
import path from "path";
import xlsx from "xlsx";

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), "api", "data", "pitch.xlsx");
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const ranks = [...new Set(rows.map(r => String(r.Rank)))];
  res.json(ranks);
}
