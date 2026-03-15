import { app, BrowserWindow, Menu, nativeTheme, Tray } from "electron";
import type { AppConfig } from "./ConfigService";
import type { OperationLogService } from "./OperationLogService";
import { getTrayIconPath, type TrayIconTheme } from "../utils/icon-paths";

type TrayMenuAction = "show" | "hide";

export class TrayService {
  private tray: Tray | null = null;

  private mainWindow: BrowserWindow | null = null;

  private trayAvailable = false;

  private closeToTrayEnabled = true;

  private quitting = false;

  private readonly handleThemeUpdated = () => {
    this.refreshTrayIcon();
  };

  private readonly handleWindowClose = (event: Electron.Event) => {
    if (this.quitting || !this.closeToTrayEnabled || !this.trayAvailable) {
      return;
    }

    event.preventDefault();
    this.hideWindow("close");
    this.operationLogService?.info(
      "app",
      "Main window hidden to tray.",
      "Close-to-tray is enabled.",
    );
  };

  private readonly handleWindowVisibilityChanged = () => {
    this.updateContextMenu();
  };

  constructor(private readonly operationLogService?: OperationLogService) {}

  initialize(mainWindow: BrowserWindow, config: AppConfig): boolean {
    this.applyPreferences(config.preferences);
    this.attachWindow(mainWindow);
    return this.ensureTray();
  }

  attachWindow(mainWindow: BrowserWindow): void {
    this.detachWindow();
    this.mainWindow = mainWindow;
    mainWindow.on("close", this.handleWindowClose);
    mainWindow.on("show", this.handleWindowVisibilityChanged);
    mainWindow.on("hide", this.handleWindowVisibilityChanged);
    mainWindow.on("minimize", this.handleWindowVisibilityChanged);
    mainWindow.on("restore", this.handleWindowVisibilityChanged);
    this.updateContextMenu();
  }

  applyPreferences(preferences: AppConfig["preferences"]): void {
    this.closeToTrayEnabled = preferences.closeToTray;
    this.updateContextMenu();
  }

  showWindow(): void {
    const mainWindow = this.getAvailableWindow();
    if (!mainWindow) {
      return;
    }

    mainWindow.setSkipTaskbar(false);
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    this.updateContextMenu();
  }

  hideWindow(reason: "close" | "menu"): void {
    const mainWindow = this.getAvailableWindow();
    if (!mainWindow) {
      return;
    }

    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
    this.updateContextMenu();

    if (reason === "menu") {
      this.operationLogService?.info("app", "Main window hidden from tray menu.");
    }
  }

  requestQuit(): void {
    this.quitting = true;
    this.operationLogService?.info("app", "Quit requested from tray menu.");
    app.quit();
  }

  markAppQuitting(): void {
    this.quitting = true;
  }

  dispose(): void {
    this.detachWindow();
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    this.trayAvailable = false;
    nativeTheme.off("updated", this.handleThemeUpdated);
  }

  private ensureTray(): boolean {
    if (this.tray) {
      this.trayAvailable = true;
      this.refreshTrayIcon();
      this.updateContextMenu();
      return true;
    }

    const trayIconPath = getTrayIconPath(this.getPreferredTheme());
    if (!trayIconPath) {
      this.trayAvailable = false;
      this.operationLogService?.warning(
        "app",
        "Tray icon asset is missing; tray integration is disabled.",
      );
      return false;
    }

    this.tray = new Tray(trayIconPath);
    this.trayAvailable = true;
    this.tray.setToolTip("SkillSwitch");
    this.tray.on("click", () => {
      this.showWindow();
    });
    this.tray.on("double-click", () => {
      this.showWindow();
    });
    nativeTheme.off("updated", this.handleThemeUpdated);
    nativeTheme.on("updated", this.handleThemeUpdated);
    this.updateContextMenu();
    this.operationLogService?.success("app", "System tray initialized.");
    return true;
  }

  private refreshTrayIcon(): void {
    if (!this.tray) {
      return;
    }

    const trayIconPath = getTrayIconPath(this.getPreferredTheme());
    if (trayIconPath) {
      this.tray.setImage(trayIconPath);
    }
  }

  private updateContextMenu(): void {
    if (!this.tray) {
      return;
    }

    const visible = this.isWindowOpen();
    const nextAction: TrayMenuAction = visible ? "hide" : "show";

    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: nextAction === "show" ? "显示窗口" : "隐藏窗口",
          click: () => {
            if (nextAction === "show") {
              this.showWindow();
              return;
            }

            this.hideWindow("menu");
          },
        },
        {
          label: "打开同步面板",
          click: () => {
            const mainWindow = this.getAvailableWindow();
            if (!mainWindow) {
              return;
            }

            this.showWindow();
            mainWindow.webContents.send("tray:openSync");
            this.operationLogService?.info("app", "Opened sync modal from tray menu.");
          },
        },
        { type: "separator" },
        {
          label: this.closeToTrayEnabled ? "关闭按钮: 最小化到托盘" : "关闭按钮: 直接退出",
          enabled: false,
        },
        {
          label: "退出应用",
          click: () => {
            this.requestQuit();
          },
        },
      ]),
    );
  }

  private isWindowOpen(): boolean {
    const mainWindow = this.getAvailableWindow();
    return !!mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized();
  }

  private getPreferredTheme(): TrayIconTheme {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  }

  private getAvailableWindow(): BrowserWindow | null {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return null;
    }

    return this.mainWindow;
  }

  private detachWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.mainWindow = null;
      return;
    }

    this.mainWindow.off("close", this.handleWindowClose);
    this.mainWindow.off("show", this.handleWindowVisibilityChanged);
    this.mainWindow.off("hide", this.handleWindowVisibilityChanged);
    this.mainWindow.off("minimize", this.handleWindowVisibilityChanged);
    this.mainWindow.off("restore", this.handleWindowVisibilityChanged);
    this.mainWindow = null;
  }
}
