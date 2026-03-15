import { SOURCE_CONFIG, SLOTS } from "../components/mockData";
import type { AppConfig } from "@/types/electron";

export function createDefaultConfig(): AppConfig {
  return {
    version: "0.1.0",
    sourceConfig: { ...SOURCE_CONFIG },
    slots: SLOTS.map((slot) => ({ ...slot })),
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
