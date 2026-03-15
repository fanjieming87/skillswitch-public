import { ipcMain } from "electron";
import { SyncParams, SyncService } from "../services/SyncService";
import { logIpcHandlerFailure } from "../utils/logger";

function registerHandle(channel: string, handler: (...args: any[]) => Promise<unknown>) {
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

export function registerSyncHandlers(syncService: SyncService): void {
  registerHandle("sync:validateSync", async (params: SyncParams) => {
    return syncService.validateSync(params);
  });

  registerHandle("sync:syncToSlots", async (params: SyncParams) => {
    return syncService.syncToSlots(params);
  });
}
