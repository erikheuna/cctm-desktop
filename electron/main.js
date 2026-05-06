let isWindowCreated = false;

async function createWindow() {
  if (isWindowCreated) return;
  isWindowCreated = true;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: "CCTDM – Number Extractor",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

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

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && isWindowCreated) {
    isWindowCreated = false;
    createWindow();
  }
});