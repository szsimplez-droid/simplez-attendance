import xlsx from "xlsx";
import path from "path";

export default function handler(req, res) {
  const { rank, pitch } = req.query;

  const filePath = path.join(process.cwd(), "pitch.xlsx");
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  const row = data.find(
    r => String(r.Rank) === rank && String(r.Pitch) === pitch
  );

  if (!row) {
    return res.status(404).json({ salary: 0 });
  }

  res.json({ salary: Number(row.Salary) });
}
