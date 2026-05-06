import { app, BrowserWindow, shell } from "electron";
import { spawn } from "child_process";
import { execPath } from "process";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow;
let backendProcess;

// ─── Chemins selon production ou développement ──────────────────────────────
const isDev = !app.isPackaged;

const backendDir = isDev
  ? path.join(__dirname, "../backend")
  : path.join(process.resourcesPath, "backend");

const frontendDist = isDev
  ? null
  : path.join(__dirname, "../frontend/dist/index.html");

// ─── Dossiers de données utilisateur (uploads / results) ────────────────────
// En production, on stocke dans les données de l'app (pas dans le bundle)
const userDataPath = app.getPath("userData");
const uploadsDir   = path.join(userDataPath, "uploads");
const resultsDir   = path.join(userDataPath, "results");

[uploadsDir, resultsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Démarrage du backend Express ───────────────────────────────────────────
function startBackend() {
  backendProcess = spawn(execPath, ["index.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "5000",
      UPLOADS_DIR: uploadsDir,
      RESULTS_DIR: resultsDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (d) =>
    console.log("[backend]", d.toString().trim())
  );
  backendProcess.stderr.on("data", (d) =>
    console.error("[backend err]", d.toString().trim())
  );
  backendProcess.on("exit", (code) =>
    console.log(`[backend] exited with code ${code}`)
  );
}

// ─── Attendre que le backend réponde ────────────────────────────────────────
function waitForBackend(port = 5000, retries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(`http://localhost:${port}/health`, (res) => resolve())
        .on("error", () => {
          if (retries-- > 0) setTimeout(attempt, 400);
          else reject(new Error("Backend n'a pas démarré à temps"));
        });
    };
    attempt();
  });
}

// ─── Création de la fenêtre principale ──────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: "CCTDM – TDM Number Extractor",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Ouvrir les liens externes dans le navigateur système
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    // En développement : charger le serveur Vite
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(frontendDist);
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  startBackend();

  try {
    await waitForBackend(5000);
    console.log("✅ Backend prêt");
  } catch (e) {
    console.error("⚠️  Backend timeout :", e.message);
    // On ouvre quand même la fenêtre
  }

  await createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});