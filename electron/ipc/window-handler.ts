import { BrowserWindow, ipcMain } from "electron";
import { logIpcHandlerFailure } from "../utils/logger";

function registerHandle(channel: string, handler: () => Promise<unknown> | unknown) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async () => {
    try {
      return await handler();
    } catch (error) {
      logIpcHandlerFailure(channel, [], error);
      throw error;
    }
  });
}

export function registerWindowHandlers(getWindow: () => BrowserWindow | null): void {
  registerHandle("window:minimize", () => {
    getWindow()?.minimize();
  });

  registerHandle("window:maximize", () => {
    const window = getWindow();
    if (!window) {
      return false;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }

    window.maximize();
    return true;
  });

  registerHandle("window:close", () => {
    getWindow()?.close();
  });

  registerHandle("window:isMaximized", () => {
    return getWindow()?.isMaximized() ?? false;
  });
}
