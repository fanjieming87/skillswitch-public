import { useEffect, useState } from "react";
import type { AppConfig } from "@/types/electron";
import { createDefaultConfig } from "./defaultConfig";

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(createDefaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      if (!window.electronAPI) {
        setLoading(false);
        return;
      }

      try {
        const next = await window.electronAPI.config.get();
        if (!cancelled) {
          setConfig(next);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load config.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveConfig = async (partial: Partial<AppConfig>): Promise<AppConfig> => {
    if (!window.electronAPI) {
      const next = {
        ...config,
        ...partial,
        sourceConfig: {
          ...config.sourceConfig,
          ...partial.sourceConfig,
        },
        preferences: {
          ...config.preferences,
          ...partial.preferences,
        },
        window: {
          ...config.window,
          ...partial.window,
        },
        slots: partial.slots ?? config.slots,
      };
      setConfig(next);
      return next;
    }

    const next = await window.electronAPI.config.set(partial);
    setConfig(next);
    setError(null);
    return next;
  };

  return {
    config,
    loading,
    error,
    saveConfig,
  };
}
