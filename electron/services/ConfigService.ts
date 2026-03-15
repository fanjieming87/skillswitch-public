import fs from "fs";
import path from "path";
import { app } from "electron";
import { DEFAULT_SOURCE_PATH } from "../utils/path-resolver";
import {
  DEFAULT_SLOT_PATHS,
  normalizeSlots,
  normalizeSourcePath,
} from "../utils/slot-defaults";

export interface ConfigSlot {
  id: string;
  name: string;
  color: string;
  dotColor: string;
  filePath: string;
  shortLabel: string;
  isSource?: boolean;
}

export interface AppConfig {
  version: string;
  sourceConfig: {
    path: string;
  };
  slots: ConfigSlot[];
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

export function createDefaultSlots(): ConfigSlot[] {
  return [
    {
      id: "codebuddy",
      name: "Codebuddy",
      color: "#4f8ef7",
      dotColor: "#4f8ef7",
      filePath: DEFAULT_SLOT_PATHS.codebuddy,
      shortLabel: "CB",
    },
    {
      id: "gemini",
      name: "Gemini",
      color: "#a78bfa",
      dotColor: "#a78bfa",
      filePath: DEFAULT_SLOT_PATHS.gemini,
      shortLabel: "GM",
    },
    {
      id: "qoder",
      name: "Qoder",
      color: "#34d399",
      dotColor: "#34d399",
      filePath: DEFAULT_SLOT_PATHS.qoder,
      shortLabel: "QD",
    },
    {
      id: "copilot",
      name: "Copilot",
      color: "#fb923c",
      dotColor: "#fb923c",
      filePath: DEFAULT_SLOT_PATHS.copilot,
      shortLabel: "CP",
    },
    {
      id: "claude",
      name: "Claude",
      color: "#f59e0b",
      dotColor: "#f59e0b",
      filePath: DEFAULT_SLOT_PATHS.claude,
      shortLabel: "CL",
    },
  ];
}

export function createDefaultConfig(): AppConfig {
  return {
    version: "0.1.0",
    sourceConfig: {
      path: DEFAULT_SOURCE_PATH,
    },
    slots: createDefaultSlots(),
    preferences: {
      theme: "system",
      autoSync: false,
      syncInterval: 0,
      backupEnabled: true,
      maxBackups: 5,
      closeToTray: true,
    },
    window: {
      width: 1280,
      height: 820,
    },
  };
}

function mergeConfig(current: AppConfig, incoming: Partial<AppConfig>): AppConfig {
  const hasIncomingSourcePath = Object.prototype.hasOwnProperty.call(incoming.sourceConfig ?? {}, "path");
  const nextSourcePath = hasIncomingSourcePath
    ? normalizeSourcePath(incoming.sourceConfig?.path ?? "", DEFAULT_SOURCE_PATH)
    : undefined;

  const nextSlots = normalizeSlots(incoming.slots ?? current.slots);

  return {
    ...current,
    ...incoming,
    sourceConfig: {
      ...current.sourceConfig,
      ...incoming.sourceConfig,
      ...(nextSourcePath !== undefined ? { path: nextSourcePath } : {}),
    },
    preferences: {
      ...current.preferences,
      ...incoming.preferences,
    },
    window: {
      ...current.window,
      ...incoming.window,
    },
    slots: nextSlots,
  };
}

export class ConfigService {
  private cachedConfig: AppConfig | null = null;

  private getConfigPath(): string {
    const userDataDir = process.env.SKILLSWITCH_USER_DATA_DIR || app.getPath("userData");
    return path.join(userDataDir, "config.json");
  }

  private readConfig(): AppConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const defaults = createDefaultConfig();
    const configPath = this.getConfigPath();

    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const stored = JSON.parse(raw) as Partial<AppConfig>;
      const normalized = mergeConfig(defaults, stored);
      this.cachedConfig = normalized;

      if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
        this.writeConfig(normalized);
      }

      return this.cachedConfig;
    } catch {
      this.cachedConfig = defaults;
      this.writeConfig(defaults);
      return defaults;
    }
  }

  private writeConfig(config: AppConfig): void {
    const configPath = this.getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    this.cachedConfig = config;
  }

  get(): AppConfig {
    return this.readConfig();
  }

  set(partial: Partial<AppConfig>): AppConfig {
    const next = mergeConfig(this.get(), partial);
    this.writeConfig(next);
    return next;
  }

  reset(): AppConfig {
    const defaults = createDefaultConfig();
    this.writeConfig(defaults);
    return defaults;
  }

  setWindowState(windowState: Partial<AppConfig["window"]>): AppConfig["window"] {
    const next = {
      ...this.get().window,
      ...windowState,
    };
    this.writeConfig({
      ...this.get(),
      window: next,
    });
    return next;
  }
}
