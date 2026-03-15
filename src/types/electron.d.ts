import type { SkillPackage, Slot, SourceConfig } from "../app/components/types";

export interface AppConfig {
  version: string;
  sourceConfig: SourceConfig;
  slots: Slot[];
  preferences: {
    theme: "light" | "dark" | "system";
    autoSync: boolean;
    syncInterval: number;
    backupEnabled: boolean;
    maxBackups: number;
    closeToTray: boolean;
  };
  window: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

export interface SyncParams {
  sourceDir: string;
  packageIds: string[];
  slotIds: string[];
  allowOverwrite?: boolean;
}

export interface SyncConflict {
  packageName: string;
  slotId: string;
  targetPath: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  conflicts: SyncConflict[];
  requiresOverwriteConfirmation: boolean;
}

export interface SyncItemResult {
  packageName: string;
  slotId: string;
  targetPath: string;
  status: "copied" | "skipped" | "failed";
  message?: string;
}

export interface SyncResult {
  total: number;
  copied: number;
  skipped: number;
  failed: number;
  items: SyncItemResult[];
}

export type OperationLogLevel = "info" | "success" | "warning" | "error";
export type OperationLogScope = "app" | "sync" | "config" | "file";

export interface OperationLogInput {
  level: OperationLogLevel;
  scope: OperationLogScope;
  message: string;
  details?: string;
}

export interface OperationLogEntry extends OperationLogInput {
  id: string;
  timestamp: string;
}

export interface ElectronAPI {
  file: {
    readSkillPackages: (dirPath: string) => Promise<SkillPackage[]>;
    readSkillPreview: (
      previewPath: string,
    ) => Promise<{ previewPath: string; previewContent: string; lastModified: string }>;
    deleteSkillDirectory: (rootPath: string, skillName: string) => Promise<string>;
    watchSourceDirectory: (dirPath: string, knownPackagePaths?: string[]) => Promise<void>;
    unwatchSourceDirectory: () => Promise<void>;
    selectDirectory: (defaultPath?: string) => Promise<string | null>;
  };
  sync: {
    validateSync: (params: SyncParams) => Promise<ValidationResult>;
    syncToSlots: (params: SyncParams) => Promise<SyncResult>;
  };
  config: {
    get: () => Promise<AppConfig>;
    set: (config: Partial<AppConfig>) => Promise<AppConfig>;
    reset: () => Promise<AppConfig>;
  };
  logs: {
    getEntries: () => Promise<OperationLogEntry[]>;
    append: (input: OperationLogInput) => Promise<OperationLogEntry>;
    clear: () => Promise<void>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
