import { ipcMain } from "electron";
import { AppConfig, ConfigService } from "../services/ConfigService";
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

export function registerConfigHandlers(
  configService: ConfigService,
  onConfigChanged?: (config: AppConfig) => void,
): void {
  registerHandle("config:get", () => configService.get());
  registerHandle("config:set", (config: Partial<AppConfig>) => {
    const nextConfig = configService.set(config);
    onConfigChanged?.(nextConfig);
    return nextConfig;
  });
  registerHandle("config:reset", () => {
    const nextConfig = configService.reset();
    onConfigChanged?.(nextConfig);
    return nextConfig;
  });
}
