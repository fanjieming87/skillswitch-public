import { useEffect, useState } from "react";
import type { OperationLogEntry, OperationLogInput } from "@/types/electron";

function buildLocalEntry(input: OperationLogInput): OperationLogEntry {
  const nowMs = Date.now();
  return {
    id: `local-log-${nowMs}-${Math.random().toString(16).slice(2, 10)}`,
    timestamp: new Date(nowMs).toISOString(),
    ...input,
  };
}

export function useOperationLogs(enabled = false) {
  const [entries, setEntries] = useState<OperationLogEntry[]>([]);

  const loadLogs = async (): Promise<OperationLogEntry[]> => {
    if (!window.electronAPI) {
      return entries;
    }

    const nextEntries = await window.electronAPI.logs.getEntries();
    setEntries(nextEntries);
    return nextEntries;
  };

  useEffect(() => {
    if (!enabled || !window.electronAPI) {
      return;
    }

    const refresh = () => {
      void loadLogs();
    };

    void loadLogs();
    window.electronAPI.on("logs:updated", refresh);

    return () => {
      window.electronAPI?.off("logs:updated", refresh);
    };
  }, []);

  const appendLog = async (input: OperationLogInput): Promise<OperationLogEntry> => {
    if (!window.electronAPI) {
      const nextEntry = buildLocalEntry(input);
      setEntries((current) => [...current.slice(-39), nextEntry]);
      return nextEntry;
    }

    return window.electronAPI.logs.append(input);
  };

  const clearLogs = async (): Promise<void> => {
    if (!window.electronAPI) {
      setEntries([]);
      return;
    }

    await window.electronAPI.logs.clear();
  };

  return {
    entries,
    loadLogs,
    appendLog,
    clearLogs,
  };
}
