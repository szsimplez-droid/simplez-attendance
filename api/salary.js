import fs from "fs";
import path from "path";
import xlsx from "xlsx";

export default function handler(req, res) {
  try {
    const { rank, pitch } = req.query;

    const filePath = path.join(
      process.cwd(),
      "api",
      "data",
      "pitch.xlsx"
    );

    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const row = rows.find(
      r =>
        String(r.Rank).trim() === rank &&
        String(r.Pitch).trim() === pitch
    );

    if (!row) {
      return res.json({ salary: 0 });
    }

    res.json({ salary: Number(row.BasicSalary) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
