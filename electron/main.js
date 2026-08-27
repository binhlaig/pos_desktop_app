/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Menu, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

// Match the normal browser origin so backend CORS rules see the same host.
const APP_URL = "http://localhost:3000";
const DEFAULT_NEXTAUTH_SECRET =
  "pos-desktop-local-nextauth-secret-change-before-shared-deployment";
let nextServerProcess = null;
let serverLogPath = null;
let electronLogPath = null;

function appendLog(filePath, message) {
  if (!filePath) {
    return;
  }

  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(filePath, line, "utf8");
}

function logElectron(message) {
  appendLog(electronLogPath, message);
}

function logServer(message) {
  appendLog(serverLogPath, message);
}

function initializeLogPaths() {
  const userDataPath = app.getPath("userData");

  serverLogPath = path.join(userDataPath, "server.log");
  electronLogPath = path.join(userDataPath, "electron.log");

  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(serverLogPath, "", "utf8");
  fs.writeFileSync(electronLogPath, "", "utf8");

  logElectron(`app.isPackaged: ${app.isPackaged}`);
  logElectron(`process.resourcesPath: ${process.resourcesPath}`);
  logElectron(`app userData path: ${userDataPath}`);
  logElectron(`server URL: ${APP_URL}`);
}

function waitForServer(url, timeoutMs = 60000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(check, 500);
      });

      request.setTimeout(2000, () => {
        request.destroy();
      });
    };

    check();
  });
}

function startNextServer() {
  if (!app.isPackaged) {
    logElectron("Skipping bundled Next.js server startup because app is not packaged.");
    return;
  }

  const standaloneServerPath = path.join(
    app.getAppPath(),
    ".next",
    "standalone",
    "server.js",
  );

  logElectron(`server.js path: ${standaloneServerPath}`);
  logServer(`server.js path: ${standaloneServerPath}`);
  logServer(`app.isPackaged: ${app.isPackaged}`);
  logServer(`process.resourcesPath: ${process.resourcesPath}`);
  logServer(`app userData path: ${app.getPath("userData")}`);
  logServer(`server URL: ${APP_URL}`);

  const serverEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3000",
    HOSTNAME: "localhost",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || APP_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || DEFAULT_NEXTAUTH_SECRET,
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080",
    REMOTE_API_BASE_URL:
      process.env.REMOTE_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8080",
    ELECTRON_RUN_AS_NODE: "1",
  };

  logServer(
    `env NODE_ENV=${serverEnv.NODE_ENV} PORT=${serverEnv.PORT} HOSTNAME=${serverEnv.HOSTNAME}`,
  );
  logServer(`env NEXTAUTH_URL=${serverEnv.NEXTAUTH_URL}`);
  logServer(
    `env NEXTAUTH_SECRET=${serverEnv.NEXTAUTH_SECRET ? "[set]" : "[missing]"}`,
  );
  logServer(`env NEXT_PUBLIC_API_BASE_URL=${serverEnv.NEXT_PUBLIC_API_BASE_URL}`);
  logServer(`env REMOTE_API_BASE_URL=${serverEnv.REMOTE_API_BASE_URL}`);

  nextServerProcess = spawn(process.execPath, [standaloneServerPath], {
    cwd: path.dirname(standaloneServerPath),
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  nextServerProcess.stdout.on("data", (data) => {
    logServer(`[stdout] ${data.toString().trimEnd()}`);
  });

  nextServerProcess.stderr.on("data", (data) => {
    logServer(`[stderr] ${data.toString().trimEnd()}`);
  });

  nextServerProcess.on("error", (error) => {
    logElectron(`Next.js server failed to start: ${error.stack || error.message}`);
    logServer(`[error] ${error.stack || error.message}`);
  });

  nextServerProcess.on("exit", (code, signal) => {
    logElectron(`Next.js server exited with code ${code} and signal ${signal}`);
    logServer(`[exit] code=${code} signal=${signal}`);
    nextServerProcess = null;
  });
}

function stopNextServer() {
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
}

async function createMainWindow() {
  startNextServer();
  await waitForServer(APP_URL);

  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: "POS Desktop App",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

app.setName("POS Desktop App");

app.whenReady().then(async () => {
  initializeLogPaths();
  Menu.setApplicationMenu(null);

  try {
    await createMainWindow();
  } catch (error) {
    logElectron(`Startup failed: ${error.stack || error.message}`);
    dialog.showErrorBox(
      "POS Desktop App",
      `Unable to start the POS desktop app.\n\n${error.message}\n\nServer log:\n${serverLogPath}`,
    );
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  stopNextServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
