import { BrowserWindow, ipcMain } from "electron";
import { OperationLogInput, OperationLogService } from "../services/OperationLogService";
import { logIpcHandlerFailure } from "../utils/logger";

function registerHandle(channel: string, handler: (...args: any[]) => Promise<unknown> | unknown) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logIpcHandlerFailure(channel, args, error);
      throw error;
    }
  });
}

export function registerLogHandlers(
  operationLogService: OperationLogService,
  getWindow: () => BrowserWindow | null,
): void {
  operationLogService.setChangeListener(() => {
    const window = getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }

    window.webContents.send("logs:updated");
  });

  registerHandle("logs:getEntries", () => operationLogService.getEntries());
  registerHandle("logs:append", (input: OperationLogInput) => operationLogService.append(input));
  registerHandle("logs:clear", () => {
    operationLogService.clear();
  });
}
