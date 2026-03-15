import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "./services/ConfigService";
import type { SkillPackage, SkillPreviewDocument } from "./services/FileService";
import type { OperationLogEntry, OperationLogInput } from "./services/OperationLogService";
import type { SyncParams, SyncResult, ValidationResult } from "./services/SyncService";

type RendererListener = (...args: any[]) => void;

const listenerMap = new Map<RendererListener, (...args: any[]) => void>();

contextBridge.exposeInMainWorld("electronAPI", {
  file: {
    readSkillPackages: (dirPath: string): Promise<SkillPackage[]> =>
      ipcRenderer.invoke("file:readSkillPackages", dirPath),
    readSkillPreview: (previewPath: string): Promise<SkillPreviewDocument> =>
      ipcRenderer.invoke("file:readSkillPreview", previewPath),
    deleteSkillDirectory: (rootPath: string, skillName: string): Promise<string> =>
      ipcRenderer.invoke("file:deleteSkillDirectory", rootPath, skillName),
    watchSourceDirectory: (dirPath: string, knownPackagePaths?: string[]): Promise<void> =>
      ipcRenderer.invoke("file:watchSourceDirectory", dirPath, knownPackagePaths),
    unwatchSourceDirectory: (): Promise<void> =>
      ipcRenderer.invoke("file:unwatchSourceDirectory"),
    selectDirectory: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke("file:selectDirectory", defaultPath),
  },
  sync: {
    validateSync: (params: SyncParams): Promise<ValidationResult> =>
      ipcRenderer.invoke("sync:validateSync", params),
    syncToSlots: (params: SyncParams): Promise<SyncResult> =>
      ipcRenderer.invoke("sync:syncToSlots", params),
  },
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke("config:get"),
    set: (config: Partial<AppConfig>): Promise<AppConfig> =>
      ipcRenderer.invoke("config:set", config),
    reset: (): Promise<AppConfig> => ipcRenderer.invoke("config:reset"),
  },
  logs: {
    getEntries: (): Promise<OperationLogEntry[]> => ipcRenderer.invoke("logs:getEntries"),
    append: (input: OperationLogInput): Promise<OperationLogEntry> =>
      ipcRenderer.invoke("logs:append", input),
    clear: (): Promise<void> => ipcRenderer.invoke("logs:clear"),
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
    maximize: (): Promise<boolean> => ipcRenderer.invoke("window:maximize"),
    close: (): Promise<void> => ipcRenderer.invoke("window:close"),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window:isMaximized"),
  },
  on: (channel: string, callback: RendererListener): void => {
    const wrapped = (_event: unknown, ...args: any[]) => callback(...args);
    listenerMap.set(callback, wrapped);
    ipcRenderer.on(channel, wrapped);
  },
  off: (channel: string, callback: RendererListener): void => {
    const wrapped = listenerMap.get(callback);
    if (!wrapped) {
      return;
    }

    ipcRenderer.off(channel, wrapped);
    listenerMap.delete(callback);
  },
});
