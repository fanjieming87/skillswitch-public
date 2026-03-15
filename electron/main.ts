import path from "path";
import { app, BrowserWindow, shell } from "electron";
import { registerConfigHandlers } from "./ipc/config-handler";
import { registerFileHandlers } from "./ipc/file-handler";
import { registerLogHandlers } from "./ipc/log-handler";
import { registerSyncHandlers } from "./ipc/sync-handler";
import { registerWindowHandlers } from "./ipc/window-handler";
import { ConfigService } from "./services/ConfigService";
import { FileService } from "./services/FileService";
import { OperationLogService } from "./services/OperationLogService";
import { SyncService } from "./services/SyncService";
import { TrayService } from "./services/TrayService";
import { getWindowIconPath } from "./utils/icon-paths";
import { ensureSingleInstance } from "./utils/single-instance";
import {
  formatUnknownError,
  getDiagnosticLogFilePath,
  getDiagnosticLogger,
  initializeDiagnosticLogger,
  mirrorOperationLogEntry,
} from "./utils/logger";

initializeDiagnosticLogger();

const appLogger = getDiagnosticLogger("app");

const configService = new ConfigService();
const fileService = new FileService();
const operationLogService = new OperationLogService(undefined, mirrorOperationLogEntry);
const syncService = new SyncService(configService, operationLogService);
const trayService = new TrayService(operationLogService);

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function revealOrCreateMainWindow(): void {
  const existingWindow = getMainWindow();
  if (existingWindow) {
    trayService.showWindow();
    return;
  }

  if (!app.isReady()) {
    return;
  }

  mainWindow = createMainWindow();
  trayService.attachWindow(mainWindow);
}

function persistWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }

  const bounds = window.getBounds();
  configService.setWindowState(bounds);
}

function attachDeferredWindowShow(window: BrowserWindow): void {
  let shown = false;

  const showWindow = () => {
    if (shown || window.isDestroyed()) {
      return;
    }

    shown = true;
    window.show();
  };

  window.once("ready-to-show", showWindow);
  window.webContents.once("did-finish-load", showWindow);
  window.webContents.once("did-fail-load", showWindow);
}

function createMainWindow(): BrowserWindow {
  const savedWindow = configService.get().window;

  const window = new BrowserWindow({
    width: savedWindow.width,
    height: savedWindow.height,
    x: savedWindow.x,
    y: savedWindow.y,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    backgroundColor: "#f9fafb",
    show: false,
    autoHideMenuBar: true,
    title: "SkillSwitch",
    icon: getWindowIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  window.on("resize", () => persistWindowState(window));
  window.on("move", () => persistWindowState(window));
  window.on("maximize", () => window.webContents.send("window:maximized", true));
  window.on("unmaximize", () => window.webContents.send("window:maximized", false));
  window.on("closed", () => {
    fileService.unwatchSourceDirectory();
    mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  attachDeferredWindowShow(window);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    // DevTools can be opened manually via keyboard shortcuts when needed
    // window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  window.setMenuBarVisibility(false);
  return window;
}

async function bootstrap(): Promise<void> {
  registerConfigHandlers(configService, (config) => {
    trayService.applyPreferences(config.preferences);
  });
  registerFileHandlers(fileService, configService, getMainWindow);
  registerLogHandlers(operationLogService, getMainWindow);
  registerWindowHandlers(getMainWindow);
  registerSyncHandlers(syncService);

  mainWindow = createMainWindow();
  trayService.initialize(mainWindow, configService.get());
  const diagnosticLogPath = getDiagnosticLogFilePath();
  appLogger.info(
    diagnosticLogPath
      ? `Diagnostic log file: ${diagnosticLogPath}`
      : "Diagnostic logger initialized.",
  );
  operationLogService.info(
    "app",
    "Application started.",
    diagnosticLogPath ? `diagnosticLogPath=${diagnosticLogPath}` : undefined,
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length > 0) {
      trayService.showWindow();
      return;
    }

    revealOrCreateMainWindow();
  });
}

if (ensureSingleInstance(() => revealOrCreateMainWindow())) {
  void app.whenReady().then(bootstrap).catch((error) => {
    appLogger.error(`Application bootstrap failed.\n${formatUnknownError(error)}`);
    app.exit(1);
  });

  app.on("before-quit", () => {
    trayService.markAppQuitting();
  });

  app.on("will-quit", () => {
    trayService.dispose();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
