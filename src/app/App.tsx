import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Minus, ScrollText, Settings, Square, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { CodeEditor } from "./components/CodeEditor";
import type { SkillPackage, Slot, SourceConfig } from "./components/types";
import type { AppConfig } from "@/types/electron";
import { useConfig } from "./hooks/useConfig";
import { useFileSystem } from "./hooks/useFileSystem";
import { useOperationLogs } from "./hooks/useOperationLogs";
import { useSync } from "./hooks/useSync";
import { appendLogBestEffort } from "./utils/operation-log-client.mjs";
import { useWindow } from "./hooks/useWindow";

const OperationLogModal = lazy(async () => ({
  default: (await import("./components/OperationLogModal")).OperationLogModal,
}));

const SettingsModal = lazy(async () => ({
  default: (await import("./components/SettingsModal")).SettingsModal,
}));

const SyncConfirmModal = lazy(async () => ({
  default: (await import("./components/SyncConfirmModal")).SyncConfirmModal,
}));

function buildSourceSlot(sourceConfig: SourceConfig): Slot {
  return {
    id: "source",
    name: "Source",
    color: "#4b5563",
    dotColor: "#4b5563",
    filePath: sourceConfig.path,
    shortLabel: "SRC",
    isSource: true,
  };
}

interface ActivePreview {
  previewContent: string;
  previewPath: string;
  rootPath: string;
  lastModified: string;
}

interface ResolvedPreviewTarget {
  previewPath: string;
  rootPath: string;
}

function isSourceSkill(
  file: SkillPackage,
): file is SkillPackage & { packagePath: string; previewPath: string } {
  return Boolean(file.packagePath && file.previewPath);
}

function matchesActiveFilter(file: SkillPackage, activeFilter?: string) {
  if (!activeFilter) {
    return true;
  }

  if (activeFilter === "source") {
    return isSourceSkill(file);
  }

  return file.slots.some((slot) => slot.slotId === activeFilter && slot.active);
}

function resolvePreviewTarget(
  file: SkillPackage,
  activeFilter: string | undefined,
  sourceConfig: SourceConfig,
  slots: Slot[],
): ResolvedPreviewTarget | null {
  if (activeFilter && activeFilter !== "source") {
    const selectedSlot = slots.find((slot) => slot.id === activeFilter);
    const slotPreview = file.slots.find(
      (slot) => slot.slotId === activeFilter && slot.active && slot.previewPath,
    );

    if (selectedSlot && slotPreview?.previewPath) {
      return {
        previewPath: slotPreview.previewPath,
        rootPath: selectedSlot.filePath,
      };
    }
  }

  if (isSourceSkill(file)) {
    return {
      previewPath: file.previewPath,
      rootPath: sourceConfig.path,
    };
  }

  const fallbackSlotPreview = file.slots.find((slot) => slot.active && slot.previewPath);
  if (!fallbackSlotPreview?.previewPath) {
    return null;
  }

  const fallbackSlot = slots.find((slot) => slot.id === fallbackSlotPreview.slotId);
  if (!fallbackSlot) {
    return null;
  }

  return {
    previewPath: fallbackSlotPreview.previewPath,
    rootPath: fallbackSlot.filePath,
  };
}

function DeferredModalFallback({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.28)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="rounded-xl px-4 py-3"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 16px 48px rgba(15, 23, 42, 0.18)",
          color: "#374151",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        {label}加载中...
      </div>
    </div>
  );
}

export default function App() {
  const { config, loading: configLoading, error: configError, saveConfig } = useConfig();
  const {
    files,
    loading: filesLoading,
    error: filesError,
    loadFiles,
    watchSourceDirectory,
    selectDirectory,
    readSkillPreview,
    deleteSkillDirectory,
    peekSkillPreview,
    clearPreviewCache,
  } = useFileSystem();
  const { syncToSlots, validateSync } = useSync();
  const { isMaximized, minimize, toggleMaximize, close } = useWindow();

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(() => {
    const saved = localStorage.getItem("activeFilter");
    return saved ? [saved] : ["source"];
  });
  const [showOperationLogs, setShowOperationLogs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [watchSeed, setWatchSeed] = useState<{ sourcePath: string; packagePaths: string[] } | null>(null);
  const lastLoggedUiErrorRef = useRef<string | null>(null);
  const lastLoggedPreviewErrorRef = useRef<string | null>(null);
  const lastWatchSeedPathRef = useRef<string | null>(null);
  const { entries: operationLogEntries, appendLog, clearLogs, loadLogs } = useOperationLogs(showOperationLogs);

  const sourceSlot = useMemo(
    () => buildSourceSlot(config.sourceConfig),
    [config.sourceConfig],
  );
  const allSlots = useMemo(() => [sourceSlot, ...config.slots], [sourceSlot, config.slots]);

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    const handleTrayOpenSync = () => {
      setShowSyncConfirm(true);
    };

    window.electronAPI.on("tray:openSync", handleTrayOpenSync);

    return () => {
      window.electronAPI?.off("tray:openSync", handleTrayOpenSync);
    };
  }, []);

  useEffect(() => {
    if (configLoading) {
      return;
    }

    let cancelled = false;
    const sourcePath = config.sourceConfig.path;
    const sourcePathChanged = lastWatchSeedPathRef.current !== sourcePath;

    if (sourcePathChanged) {
      setWatchSeed(null);
    }

    void loadFiles(sourcePath).then((nextFiles) => {
      if (cancelled || !sourcePathChanged) {
        return;
      }

      lastWatchSeedPathRef.current = sourcePath;
      setWatchSeed({
        sourcePath,
        packagePaths: nextFiles
          .filter(isSourceSkill)
          .map((file) => file.packagePath),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [configLoading, config.sourceConfig.path, config.slots]);

  useEffect(() => {
    if (
      configLoading ||
      !config.sourceConfig.path.trim() ||
      !watchSeed ||
      watchSeed.sourcePath !== config.sourceConfig.path
    ) {
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    // Reuse the initial scan result as a watcher seed to avoid an immediate duplicate directory walk.
    void watchSourceDirectory(
      config.sourceConfig.path,
      () => {
        void loadFiles(config.sourceConfig.path);
      },
      watchSeed.packagePaths,
    )
      .then((stopWatching) => {
        if (disposed) {
          stopWatching();
          return;
        }

        cleanup = stopWatching;
      })
      .catch(() => {
        // Loading already reports watcher setup failures through the file-system hook.
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [configLoading, config.sourceConfig.path, config.slots, watchSeed]);

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFileId(null);
      return;
    }

    setSelectedFileId((current) =>
      current && files.some((file) => file.id === current) ? current : files[0].id,
    );
  }, [files]);

  useEffect(() => {
    const activeFilter = activeFilters[0];
    const visibleFiles = files.filter((file) => matchesActiveFilter(file, activeFilter));

    if (visibleFiles.length === 0) {
      setSelectedFileId(null);
      return;
    }

    setSelectedFileId((current) =>
      current && visibleFiles.some((file) => file.id === current) ? current : visibleFiles[0].id,
    );
  }, [activeFilters, files]);

  useEffect(() => {
    const activeFilter = activeFilters[0];
    if (!activeFilter || activeFilter === "source") {
      return;
    }

    if (!allSlots.some((slot) => slot.id === activeFilter)) {
      setActiveFilters(["source"]);
      localStorage.setItem("activeFilter", "source");
    }
  }, [activeFilters, allSlots]);

  const activeFilter = activeFilters[0] ?? "source";
  const sourceFiles = useMemo(() => files.filter(isSourceSkill), [files]);
  const selectedFile = selectedFileId ? files.find((file) => file.id === selectedFileId) ?? null : null;
  const selectedDeleteSlot =
    activeFilter !== "source"
      ? config.slots.find((slot) => slot.id === activeFilter) ?? null
      : null;
  const canDeleteSelectedSkill =
    !!selectedFile &&
    !!selectedDeleteSlot &&
    selectedFile.slots.some(
      (slot) => slot.slotId === selectedDeleteSlot.id && slot.active,
    );
  const combinedError = filesError ?? configError;
  const emptyStateError = combinedError ?? previewError;

  useEffect(() => {
    if (!combinedError) {
      lastLoggedUiErrorRef.current = null;
      return;
    }

    if (lastLoggedUiErrorRef.current === combinedError) {
      return;
    }

    lastLoggedUiErrorRef.current = combinedError;
    appendLogBestEffort(appendLog, {
      level: "error",
      scope: filesError ? "file" : "config",
      message: "Application encountered an error while loading data.",
      details: combinedError,
    });
  }, [combinedError, configError, filesError]);

  useEffect(() => {
    if (!previewError) {
      lastLoggedPreviewErrorRef.current = null;
      return;
    }

    if (lastLoggedPreviewErrorRef.current === previewError) {
      return;
    }

    lastLoggedPreviewErrorRef.current = previewError;
    appendLogBestEffort(appendLog, {
      level: "error",
      scope: "file",
      message: "Failed to load the selected skill preview.",
      details: previewError,
    });
  }, [appendLog, previewError]);

  useEffect(() => {
    if (!selectedFile) {
      setActivePreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const previewTarget = resolvePreviewTarget(
      selectedFile,
      activeFilters[0],
      config.sourceConfig,
      config.slots,
    );

    if (!previewTarget) {
      setActivePreview(null);
      setPreviewError("Failed to resolve a preview target for the selected skill.");
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    const cachedPreview = peekSkillPreview(previewTarget.previewPath);
    if (cachedPreview) {
      setActivePreview({
        previewContent: cachedPreview.previewContent,
        previewPath: cachedPreview.previewPath,
        rootPath: previewTarget.rootPath,
        lastModified: cachedPreview.lastModified,
      });
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    setActivePreview({
      previewContent: "",
      previewPath: previewTarget.previewPath,
      rootPath: previewTarget.rootPath,
      lastModified: selectedFile.lastModified,
    });
    setPreviewLoading(true);
    setPreviewError(null);

    void readSkillPreview(previewTarget.previewPath)
      .then((previewDocument) => {
        if (cancelled) {
          return;
        }

        setActivePreview({
          previewContent: previewDocument.previewContent,
          previewPath: previewDocument.previewPath,
          rootPath: previewTarget.rootPath,
          lastModified: previewDocument.lastModified,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setPreviewError(
          error instanceof Error ? error.message : "Failed to load the selected skill preview.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, activeFilters, config.sourceConfig.path, config.slots]);

  const handleToggleFilter = (slotId: string) => {
    setActiveFilters([slotId]);
    localStorage.setItem("activeFilter", slotId);
  };

  const handleSaveSettings = async (
    newSlots: Slot[],
    newSourceConfig: SourceConfig,
    newPreferences: AppConfig["preferences"],
  ) => {
    try {
      await saveConfig({
        sourceConfig: newSourceConfig,
        slots: newSlots,
        preferences: newPreferences,
      });

      const activeFilter = activeFilters[0];
      if (
        activeFilter &&
        activeFilter !== "source" &&
        !newSlots.some((slot) => slot.id === activeFilter)
      ) {
        setActiveFilters(["source"]);
        localStorage.setItem("activeFilter", "source");
      }

      await loadFiles(newSourceConfig.path);
      appendLogBestEffort(appendLog, {
        level: "success",
        scope: "config",
        message: "Saved settings changes.",
        details: `source=${newSourceConfig.path}\nslots=${newSlots.length}\ncloseToTray=${String(
          newPreferences.closeToTray,
        )}`,
      });
    } catch (error) {
      appendLogBestEffort(appendLog, {
        level: "error",
        scope: "config",
        message: "Failed to save settings changes.",
        details: error instanceof Error ? error.message : "Unknown settings save error.",
      });
      throw error;
    }
  };

  const handleSyncConfirmed = async (
    selectedPackageIds: string[],
    selectedSlotIds: string[],
  ): Promise<boolean> => {
    const validation = await validateSync({
      sourceDir: config.sourceConfig.path,
      packageIds: selectedPackageIds,
      slotIds: selectedSlotIds,
    });

    if (!validation.valid) {
      appendLogBestEffort(appendLog, {
        level: "error",
        scope: "sync",
        message: "Sync validation failed.",
        details: validation.errors.join("\n"),
      });
      throw new Error(validation.errors.join("\n"));
    }

    if (validation.requiresOverwriteConfirmation) {
      const conflictLines = validation.conflicts
        .map((conflict) => {
          const slot = config.slots.find((candidate) => candidate.id === conflict.slotId);
          return `${conflict.packageName} -> ${slot?.name ?? conflict.slotId}\n${conflict.targetPath}`;
        })
        .join("\n\n");

      const confirmed = window.confirm(
        `以下目标位置已存在同名技能目录，确认后将直接覆盖：\n\n${conflictLines}`,
      );

      if (!confirmed) {
        appendLogBestEffort(appendLog, {
          level: "warning",
          scope: "sync",
          message: "User cancelled overwrite confirmation.",
          details: conflictLines,
        });
        return false;
      }
    }

    await syncToSlots({
      sourceDir: config.sourceConfig.path,
      packageIds: selectedPackageIds,
      slotIds: selectedSlotIds,
      allowOverwrite: validation.requiresOverwriteConfirmation,
    });

    clearPreviewCache();
    await loadFiles(config.sourceConfig.path);
    return true;
  };

  const handleBrowseSource = async (currentPath: string) => {
    return selectDirectory(currentPath);
  };

  const handleBrowseSlot = async (_slotId: string, currentPath: string) => {
    return selectDirectory(currentPath);
  };

  const handleDeleteSelectedSkill = async () => {
    if (!selectedFile || !selectedDeleteSlot) {
      return;
    }

    const targetPath = `${selectedDeleteSlot.filePath.replace(/[\\/]+$/, "")}\\${selectedFile.name}`;
    const confirmed = window.confirm(
      `将永久删除 ${selectedDeleteSlot.name} 槽位中的技能目录：\n\n${targetPath}\n\n此操作不可恢复，是否继续？`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteLoading(true);

    try {
      const deletedPath = await deleteSkillDirectory(selectedDeleteSlot.filePath, selectedFile.name);
      clearPreviewCache();
      await loadFiles(config.sourceConfig.path);
      appendLogBestEffort(appendLog, {
        level: "success",
        scope: "file",
        message: `Deleted ${selectedFile.name} from ${selectedDeleteSlot.name}.`,
        details: deletedPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown delete error.";
      appendLogBestEffort(appendLog, {
        level: "error",
        scope: "file",
        message: `Failed to delete ${selectedFile.name} from ${selectedDeleteSlot.name}.`,
        details: `${message}\n${targetPath}`,
      });
      window.alert(`删除失败：\n${message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{
        backgroundColor: "#f9fafb",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <div
        className="flex items-center justify-between border-b border-gray-200 bg-white pl-4"
        style={
          {
            minHeight: 44,
            WebkitAppRegion: "drag",
          } as CSSProperties
        }
      >
        <div className="flex items-center gap-2 py-2">
          <div className="flex items-center gap-2">
            <span
              style={{
                color: "#1f2937",
                fontWeight: 600,
                fontSize: "13px",
                letterSpacing: "-0.01em",
              }}
            >
              SkillSwitch
            </span>
            <span
              style={{
                color: "#6b7280",
                fontSize: "10px",
                fontWeight: 400,
              }}
            >
              v0.1.0
            </span>
          </div>
        </div>

        <div
          className="flex items-stretch"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
        >
          <div className="flex items-center gap-2 pr-2">
            <button
              onClick={() => setShowSyncConfirm(true)}
              data-testid="open-sync-modal-button"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-all hover:bg-blue-700"
              disabled={filesLoading || sourceFiles.length === 0}
            >
              同步到本地
            </button>

            <button
              onClick={() => {
                setShowOperationLogs(true);
                void loadLogs();
              }}
              data-testid="open-log-modal-button"
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium transition-all hover:bg-gray-50"
              style={{ color: "#4b5563" }}
              title="查看操作日志"
            >
              <ScrollText size={14} />
              日志
            </button>

            <button
              onClick={() => setShowSettings(true)}
              data-testid="open-settings-button"
              className="rounded-md p-1.5 hover:bg-gray-100"
              title="Settings"
            >
              <Settings size={18} style={{ color: "#4b5563" }} />
            </button>
          </div>

          <button
            onClick={() => void minimize()}
            className="flex w-12 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => void toggleMaximize()}
            className="flex w-12 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => void close()}
            className="flex w-12 items-center justify-center text-gray-600 transition-colors hover:bg-red-500 hover:text-white"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          allSlots={allSlots}
          files={files}
          selectedFileId={selectedFileId}
          onSelectFile={setSelectedFileId}
          activeFilters={activeFilters}
          onToggleFilter={handleToggleFilter}
          sourceConfig={config.sourceConfig}
        />

        <div className="flex-1 overflow-hidden">
          {filesLoading || configLoading ? (
            <div className="flex h-full items-center justify-center">
              <p style={{ color: "#6b7280" }}>Loading skills...</p>
            </div>
          ) : selectedFile && activePreview ? (
            <CodeEditor
              file={selectedFile}
              allSlots={allSlots}
              activeFilters={activeFilters}
              previewContent={activePreview.previewContent}
              previewPath={activePreview.previewPath}
              previewRootPath={activePreview.rootPath}
              previewLastModified={activePreview.lastModified}
              previewLoading={previewLoading}
              previewError={previewError}
              canDelete={canDeleteSelectedSkill}
              deleteLoading={deleteLoading}
              onDelete={() => void handleDeleteSelectedSkill()}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8">
              <p
                className="text-center"
                style={{ color: emptyStateError ? "#dc2626" : "#6b7280" }}
              >
                {emptyStateError ??
                  "No skill directories with skill.md were found in the current source directory."}
              </p>
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <Suspense fallback={<DeferredModalFallback label="设置面板" />}>
          <SettingsModal
            slots={config.slots}
            sourceConfig={config.sourceConfig}
            preferences={config.preferences}
            onClose={() => setShowSettings(false)}
            onSave={handleSaveSettings}
            onBrowseSource={handleBrowseSource}
            onBrowseSlot={handleBrowseSlot}
          />
        </Suspense>
      )}

      {showOperationLogs && (
        <Suspense fallback={<DeferredModalFallback label="日志面板" />}>
          <OperationLogModal
            entries={operationLogEntries}
            onClose={() => setShowOperationLogs(false)}
            onClear={clearLogs}
          />
        </Suspense>
      )}

      {showSyncConfirm && (
        <Suspense fallback={<DeferredModalFallback label="同步面板" />}>
          <SyncConfirmModal
            files={sourceFiles}
            slots={config.slots}
            sourceConfig={config.sourceConfig}
            onClose={() => setShowSyncConfirm(false)}
            onConfirm={handleSyncConfirmed}
          />
        </Suspense>
      )}
    </div>
  );
}
