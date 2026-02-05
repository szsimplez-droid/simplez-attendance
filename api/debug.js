import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const base = process.cwd();

  let tree = [];
  try {
    tree = fs.readdirSync(base);
  } catch (e) {
    return res.json({ error: e.message });
  }

  res.json({
    cwd: base,
    files: tree,
    apiFiles: fs.readdirSync(path.join(base, "api")),
    apiData: fs.existsSync(path.join(base, "api", "data"))
      ? fs.readdirSync(path.join(base, "api", "data"))
      : "NO /api/data FOLDER"
  });
}
