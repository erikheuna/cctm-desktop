// backend/index.js — version adaptée pour Electron desktop
import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Dossiers dynamiques (injectés par Electron en prod) ────────────────────
// En dev : ./uploads et ./results à côté de ce fichier
// En prod : dossier userData d'Electron (passé via variables d'env)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
const RESULTS_DIR = process.env.RESULTS_DIR || path.join(__dirname, "results");

[UPLOADS_DIR, RESULTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Servir les fichiers résultats générés
app.use("/results", express.static(RESULTS_DIR));

// ─── Health check (utilisé par Electron pour attendre le démarrage) ─────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Upload ──────────────────────────────────────────────────────────────────
const upload = multer({ dest: UPLOADS_DIR });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("Aucun fichier reçu");
  res.json({ filePath: req.file.path });
});

// ─── Extraction / filtrage ───────────────────────────────────────────────────
app.post("/extract", async (req, res) => {
  const { command, filePath, format } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).send("Fichier introuvable");
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const resultLines = command
    ? content.split("\n").filter((line) => line.includes(command))
    : content.split("\n");

  const baseName = path.basename(filePath, path.extname(filePath));

  const outputFile =
    format === "excel"
      ? path.join(RESULTS_DIR, `${baseName}_filtered.xlsx`)
      : path.join(RESULTS_DIR, `${baseName}_filtered.txt`);

  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Résultats");
    sheet.columns = [{ header: "Lignes filtrées", key: "line", width: 80 }];
    resultLines.forEach((line) => sheet.addRow({ line }));
    await workbook.xlsx.writeFile(outputFile);
  } else {
    fs.writeFileSync(outputFile, resultLines.join("\n"), "utf-8");
  }

  // URL de téléchargement — toujours localhost:5000
  const fileName = path.basename(outputFile);
  res.json({
    message: "Extraction terminée",
    downloadUrl: `http://localhost:${PORT}/results/${fileName}`,
  });
});

// ─── Démarrage ───────────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`🚀 Backend démarré sur http://localhost:${PORT}`)
);