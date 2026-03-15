import { BrowserWindow, ipcMain } from "electron";
import { ConfigService } from "../services/ConfigService";
import { FileService } from "../services/FileService";
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

export function registerFileHandlers(
  fileService: FileService,
  configService: ConfigService,
  getWindow: () => BrowserWindow | null,
): void {
  registerHandle("file:readSkillPackages", async (dirPath: string) => {
    return fileService.readSkillPackages(dirPath, configService.get().slots);
  });

  registerHandle("file:readSkillPreview", async (previewPath: string) => {
    return fileService.readSkillPreview(previewPath);
  });

  registerHandle("file:deleteSkillDirectory", async (rootPath: string, skillName: string) => {
    return fileService.deleteSkillDirectory(rootPath, skillName);
  });

  registerHandle("file:watchSourceDirectory", async (dirPath: string, knownPackagePaths?: string[]) => {
    const config = configService.get();
    await fileService.watchSourceDirectory(dirPath, () => {
      const window = getWindow();
      if (!window || window.isDestroyed()) {
        return;
      }

      window.webContents.send("file:sourceDirectoryChanged");
    }, knownPackagePaths, config.slots);
  });

  registerHandle("file:unwatchSourceDirectory", async () => {
    fileService.unwatchSourceDirectory();
  });

  registerHandle("file:selectDirectory", async (defaultPath?: string) => {
    return fileService.selectDirectory(getWindow() ?? undefined, defaultPath);
  });
}
