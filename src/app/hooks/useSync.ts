import type { SyncParams, SyncResult, ValidationResult } from "@/types/electron";

const emptySyncResult: SyncResult = {
  total: 0,
  copied: 0,
  skipped: 0,
  failed: 0,
  items: [],
};

export function useSync() {
  const validateSync = async (params: SyncParams): Promise<ValidationResult> => {
    if (!window.electronAPI) {
      return {
        valid: params.packageIds.length > 0 && params.slotIds.length > 0,
        errors: [],
        conflicts: [],
        requiresOverwriteConfirmation: false,
      };
    }

    return window.electronAPI.sync.validateSync(params);
  };

  const syncToSlots = async (params: SyncParams): Promise<SyncResult> => {
    if (!window.electronAPI) {
      return emptySyncResult;
    }

    return window.electronAPI.sync.syncToSlots(params);
  };

  return {
    validateSync,
    syncToSlots,
  };
}
