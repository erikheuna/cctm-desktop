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
let isWindowCreated = false;

const isDev = !app.isPackaged;

const backendDir = isDev
  ? path.join(__dirname, "../backend")
  : path.join(process.resourcesPath, "backend");

const frontendDist = isDev
  ? null
  : path.join(app.getAppPath(), "frontend", "dist", "index.html");

const userDataPath = app.getPath("userData");
const uploadsDir = path.join(userDataPath, "uploads");
const resultsDir = path.join(userDataPath, "results");

[uploadsDir, resultsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function startBackend() {
  const nodeCmd = process.platform === "win32" ? "node.exe" : execPath;

  backendProcess = spawn(nodeCmd, ["index.js"], {
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
  backendProcess.on("exit", (code) => {
    console.log(`[backend] exited with code ${code}`);
    backendProcess = null;
  });
}

function waitForBackend(port = 5000, retries = 10) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(`http://localhost:${port}/health`, (res) => resolve())
        .on("error", () => {
          if (retries-- > 0) setTimeout(attempt, 1000);
          else reject(new Error("Backend n'a pas démarré à temps"));
        });
    };
    attempt();
  });
}

async function createWindow() {
  if (isWindowCreated) return;
  isWindowCreated = true;

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

  mainWindow.webContents.openDevTools();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(frontendDist);
  }
}

app.whenReady().then(async () => {
  if (!isDev) {
    startBackend();
    try {
      await waitForBackend(5000);
      console.log("✅ Backend prêt");
    } catch (e) {
      console.error("⚠️  Backend timeout :", e.message);
    }
  }
  await createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    isWindowCreated = false;
    createWindow();
  }
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});