import { useState } from "react";
import { X, GitBranch, Check, ArrowDown, AlertTriangle, Folder } from "lucide-react";
import type { Slot, SkillPackage, SourceConfig } from "./types";

interface SyncConfirmModalProps {
  files: SkillPackage[];
  slots: Slot[];
  sourceConfig: SourceConfig;
  onClose: () => void;
  onConfirm: (selectedPackageIds: string[], selectedSlotIds: string[]) => Promise<boolean | void> | boolean | void;
}

export function SyncConfirmModal({
  files,
  slots,
  sourceConfig,
  onClose,
  onConfirm,
}: SyncConfirmModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    () => new Set(files.map((file) => file.id)),
  );
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(
    () => new Set(slots.map((slot) => slot.id)),
  );

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleToggleSelectAll = () => {
    if (selectedFileIds.size === filteredFiles.length) {
      setSelectedFileIds(new Set());
      return;
    }

    setSelectedFileIds(new Set(filteredFiles.map((file) => file.id)));
  };

  const handleToggleSelectFile = (fileId: string) => {
    setSelectedFileIds((previous) => {
      const next = new Set(previous);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleToggleSelectSlot = (slotId: string) => {
    setSelectedSlotIds((previous) => {
      const next = new Set(previous);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
      return next;
    });
  };

  const handleToggleSelectAllSlots = () => {
    if (selectedSlotIds.size === slots.length) {
      setSelectedSlotIds(new Set());
      return;
    }

    setSelectedSlotIds(new Set(slots.map((slot) => slot.id)));
  };

  const handleConfirm = async () => {
    setSyncing(true);

    try {
      const completed = await onConfirm(Array.from(selectedFileIds), Array.from(selectedSlotIds));
      if (completed === false) {
        setSyncing(false);
        return;
      }

      setError(null);
      setSyncing(false);
      setDone(true);
    } catch (syncError) {
      setSyncing(false);
      setError(syncError instanceof Error ? syncError.message : "同步失败。");
    }
  };

  return (
    <div
      data-testid="sync-modal"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !syncing) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl"
        style={{
          width: 540,
          maxHeight: "80vh",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fafafa" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                border: "1px solid #2563eb",
              }}
            >
              <ArrowDown size={14} style={{ color: "#ffffff" }} />
            </div>
            <div>
              <h2 style={{ color: "#111827", fontWeight: 600, fontSize: "14px" }}>
                Sync from Source
              </h2>
              <p style={{ color: "#6b7280", fontSize: "11px" }}>
                Copy selected skill directories to the chosen local slots
              </p>
            </div>
          </div>
          {!syncing && !done && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 transition-all hover:bg-gray-50"
              style={{
                backgroundColor: "#ffffff",
                color: "#4b5563",
                fontSize: "12px",
                fontWeight: 500,
              }}
              title="关闭"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div
          className="mx-5 mt-3 rounded-xl p-3"
          style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, #2a3a7e, #4a5aae)",
                border: "1px solid #4a5aae",
              }}
            >
              <GitBranch size={12} style={{ color: "#ffffff" }} />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="shrink-0 text-[9px] font-bold uppercase tracking-widest"
                style={{ color: "#6b7280" }}
              >
                Source
              </span>
              <span
                className="truncate"
                style={{
                  color: "#1f2937",
                  fontSize: "11px",
                  fontFamily: "'SF Mono', monospace",
                  fontWeight: 500,
                }}
              >
                {sourceConfig.path}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
              <span className="text-[10px] font-semibold" style={{ color: "#10b981" }}>
                connected
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              <GitBranch size={11} style={{ color: "#4b5563" }} />
              <span className="text-[10px] font-semibold" style={{ color: "#1f2937" }}>
                Source Repo
              </span>
            </div>

            <div className="flex items-center gap-2 px-2" style={{ color: "#9ca3af" }}>
              <ArrowDown size={12} style={{ transform: "rotate(-90deg)", color: "#2563eb" }} />
              <span className="text-[10px] font-medium" style={{ color: "#6b7280" }}>
                同步到
              </span>
              <ArrowDown size={12} style={{ transform: "rotate(-90deg)", color: "#2563eb" }} />
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {slots.map((slot) => {
                const isSelected = selectedSlotIds.has(slot.id);
                return (
                  <button
                    key={slot.id}
                    onClick={() => handleToggleSelectSlot(slot.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105"
                    style={{
                      backgroundColor: isSelected ? slot.color : "#ffffff",
                      border: `1px solid ${isSelected ? slot.color : "#e5e7eb"}`,
                      color: isSelected ? "#ffffff" : slot.color,
                      boxShadow: isSelected ? `0 2px 4px ${slot.color}33` : "none",
                    }}
                    title={`同步到 ${slot.name}`}
                  >
                    {slot.name}
                  </button>
                );
              })}
            </div>

            {slots.length > 0 && (
              <button
                onClick={handleToggleSelectAllSlots}
                data-testid="sync-toggle-all-slots-button"
                className="ml-3 shrink-0 text-[10px] transition-all hover:underline"
                style={{
                  color: selectedSlotIds.size === slots.length ? "#2563eb" : "#6b7280",
                  fontWeight: 600,
                }}
                title={selectedSlotIds.size === slots.length ? "取消全选" : "全选"}
              >
                {selectedSlotIds.size === slots.length ? "取消全选" : "全选"}
              </button>
            )}
          </div>
        </div>

        <div className="mx-5 mb-2" style={{ height: 1, backgroundColor: "#e5e7eb" }} />

        <div className="px-5 mb-2">
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#6b7280" }}
            >
              Skills to sync ({selectedFileIds.size}/{filteredFiles.length})
            </span>
              <button
                onClick={handleToggleSelectAll}
                data-testid="sync-toggle-all-files-button"
                className="text-[10px] transition-all hover:underline"
                style={{
                  color: selectedFileIds.size === filteredFiles.length ? "#2563eb" : "#4b5563",
                fontWeight: 600,
              }}
            >
              {selectedFileIds.size === filteredFiles.length ? "取消全选" : "全选"}
            </button>
          </div>

          <div className="relative mb-3">
            <input
              type="text"
              placeholder="筛选技能..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg py-1.5 pl-8 pr-8 text-xs outline-none transition-all"
              style={{
                backgroundColor: "#f3f4f6",
                border: "1px solid #e5e7eb",
                color: "#1f2937",
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5"
                style={{ color: "#9ca3af" }}
                title="清除搜索"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div
          className="px-5 mb-3"
          style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700 }}
        >
          <div className="flex items-center justify-between uppercase tracking-widest">
            <span>Skill directories ({files.length})</span>
            <span>Active Slots</span>
          </div>
        </div>

        <div
          className="flex-1 space-y-1.5 overflow-y-auto px-5 pb-2"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#d1d5db transparent",
            maxHeight: 260,
          }}
        >
          {filteredFiles.map((file) => {
            const activeSlots = file.slots.filter((slot) => slot.active);
            const hasActive = activeSlots.length > 0;
            const isSelected = selectedFileIds.has(file.id);

            return (
              <div
                key={file.id}
                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-all"
                style={{
                  backgroundColor: isSelected ? "#eff6ff" : hasActive ? "#f9fafb" : "#f3f4f6",
                  border: `1px solid ${isSelected ? "#bfdbfe" : "#e5e7eb"}`,
                  opacity: hasActive ? 1 : 0.72,
                }}
                onClick={() => handleToggleSelectFile(file.id)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all"
                    style={{
                      backgroundColor: isSelected ? "#2563eb" : "#ffffff",
                      borderColor: isSelected ? "#2563eb" : "#d1d5db",
                    }}
                  >
                    {isSelected && <Check size={12} style={{ color: "#ffffff" }} />}
                  </div>

                  <div
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: hasActive ? "#10b981" : "#9ca3af" }}
                  />

                  <Folder size={13} style={{ color: isSelected ? "#2563eb" : "#6b7280" }} />

                  <div className="min-w-0">
                    <div
                      className="truncate"
                      style={{
                        color: "#1f2937",
                        fontFamily: "'SF Mono', monospace",
                        fontSize: "11px",
                        fontWeight: 500,
                      }}
                    >
                      {file.name}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: "10px" }}>skill.md + nested files</div>
                  </div>
                </div>

                <div className="ml-3 flex shrink-0 items-center gap-1">
                  {activeSlots.map((assignment) => {
                    const slot = slots.find((item) => item.id === assignment.slotId);
                    if (!slot) {
                      return null;
                    }

                    return (
                      <span
                        key={assignment.slotId}
                        className="rounded-md px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: slot.color,
                          border: `1px solid ${slot.color}`,
                          color: "#ffffff",
                          padding: "2px 8px",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        {slot.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="mx-5 mt-3 flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{
            backgroundColor: error ? "#fef2f2" : "#eff6ff",
            border: `1px solid ${error ? "#fecaca" : "#bfdbfe"}`,
          }}
        >
          <AlertTriangle
            size={12}
            className="mt-0.5 shrink-0"
            style={{ color: error ? "#dc2626" : "#2563eb" }}
          />
          <p
            style={{
              color: error ? "#b91c1c" : "#1e40af",
              fontSize: "10.5px",
              lineHeight: "1.6",
            }}
          >
            {error ??
              `将把 ${selectedFileIds.size} 个技能目录整体复制到 ${selectedSlotIds.size} 个目标槽位。若目标已存在同名目录，会先提示确认，然后直接覆盖。`}
            {selectedSlotIds.size === 0 && (
              <span className="mt-1 block font-semibold text-red-600">
                请至少选择一个目标槽位
              </span>
            )}
          </p>
        </div>

        <div
          className="flex shrink-0 items-center justify-between px-5 py-4"
          style={{ borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}
        >
          {done ? (
            <span style={{ color: "#10b981", fontSize: "10px", fontWeight: 600 }}>
              ✓ 同步完成
            </span>
          ) : (
            <span style={{ color: "#6b7280", fontSize: "10px" }}>
              已选择 {selectedFileIds.size} 个技能目录，{selectedSlotIds.size} 个槽位
            </span>
          )}

          <div className="flex items-center gap-2">
            {!syncing && !done && (
              <button
                onClick={onClose}
                className="rounded-xl border border-gray-300 px-4 py-2 transition-all hover:bg-gray-50"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#4b5563",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                取消
              </button>
            )}

            {!done && (
              <button
                onClick={() => void handleConfirm()}
                data-testid="sync-confirm-button"
                disabled={syncing || selectedFileIds.size === 0 || selectedSlotIds.size === 0}
                className="flex items-center gap-2 rounded-xl border px-5 py-2 transition-all duration-200"
                style={{
                  backgroundColor: syncing ? "#3b82f6" : "#2563eb",
                  border: `1px solid ${syncing ? "#3b82f6" : "#2563eb"}`,
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "12px",
                  opacity:
                    syncing || selectedFileIds.size === 0 || selectedSlotIds.size === 0 ? 0.5 : 1,
                  cursor:
                    syncing || selectedFileIds.size === 0 || selectedSlotIds.size === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {syncing ? (
                  <>
                    <ArrowDown size={13} className="animate-bounce" />
                    同步中…
                  </>
                ) : (
                  <>
                    <ArrowDown size={13} />
                    确认同步
                  </>
                )}
              </button>
            )}

            {done && (
              <button
                onClick={onClose}
                className="rounded-xl border border-gray-300 px-5 py-2 transition-all hover:bg-gray-50"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#4b5563",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
