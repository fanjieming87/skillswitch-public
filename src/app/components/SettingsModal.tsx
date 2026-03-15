import { useState } from "react";
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  FolderOpen,
  Save,
  Check,
  Lock,
  GitBranch,
} from "lucide-react";
import type { AppConfig } from "@/types/electron";
import type { Slot, SourceConfig } from "./types";

interface SettingsModalProps {
  slots: Slot[];
  sourceConfig: SourceConfig;
  preferences: AppConfig["preferences"];
  onClose: () => void;
  onSave: (
    slots: Slot[],
    sourceConfig: SourceConfig,
    preferences: AppConfig["preferences"],
  ) => Promise<void> | void;
  onBrowseSource: (currentPath: string) => Promise<string | null>;
  onBrowseSlot: (slotId: string, currentPath: string) => Promise<string | null>;
}

const PRESET_COLORS = [
  "#4f8ef7",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#f59e0b",
  "#f472b6",
  "#38bdf8",
  "#e879f9",
];

export function SettingsModal({
  slots,
  sourceConfig,
  preferences,
  onClose,
  onSave,
  onBrowseSource,
  onBrowseSlot,
}: SettingsModalProps) {
  const [localSlots, setLocalSlots] = useState<Slot[]>(
    slots.map((s) => ({ ...s }))
  );
  const [localSource, setLocalSource] = useState<SourceConfig>({
    ...sourceConfig,
  });
  const [localPreferences, setLocalPreferences] = useState<AppConfig["preferences"]>({
    ...preferences,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  const updateSlot = (id: string, field: keyof Slot, value: string) => {
    setLocalSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const addSlot = () => {
    const newSlot: Slot = {
      id: `slot-${Date.now()}`,
      name: "New Slot",
      color: PRESET_COLORS[localSlots.length % PRESET_COLORS.length],
      dotColor: PRESET_COLORS[localSlots.length % PRESET_COLORS.length],
      filePath: "%USERPROFILE%\\",
      shortLabel: "NS",
    };
    setLocalSlots((prev) => [...prev, newSlot]);
  };

  const removeSlot = (id: string) => {
    setLocalSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newSlots = [...localSlots];
    const [removed] = newSlots.splice(dragIndex, 1);
    newSlots.splice(dropIndex, 0, removed);
    setLocalSlots(newSlots);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async () => {
    try {
      await onSave(localSlots, localSource, localPreferences);
      setError(null);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存配置失败。");
    }
  };

  return (
    <div
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 620,
          maxHeight: "86vh",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fafafa" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                border: "1px solid #2563eb",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect
                  x="2" y="2" width="12" height="12" rx="2"
                  stroke="#ffffff" strokeWidth="1.5" fill="none"
                />
                <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5" y1="8" x2="11" y2="8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="5" y1="10.5" x2="8.5" y2="10.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 style={{ color: "#111827", fontWeight: 600, fontSize: "14px" }}>
                Slot Manager
              </h2>
              <p style={{ color: "#6b7280", fontSize: "11px" }}>
                Configure source repo and sync destinations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all border border-gray-300 hover:bg-gray-50"
            style={{
              backgroundColor: "#ffffff",
              color: "#4b5563",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Column Headers */}
        <div
          className="flex items-center gap-3 px-5 py-2"
          style={{ borderBottom: "1px solid #e5e7eb" }}
        >
          <div className="w-5 shrink-0" />
          <div className="w-5 shrink-0" />
          <p
            className="flex-1 text-[9px] uppercase tracking-widest"
            style={{ color: "#6b7280", fontWeight: 700 }}
          >
            Name
          </p>
          <p
            className="flex-1 text-[9px] uppercase tracking-widest"
            style={{ color: "#6b7280", fontWeight: 700 }}
          >
            Path
          </p>
          <div className="w-7 shrink-0" />
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 py-3 space-y-2"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#d1d5db transparent" }}
        >
          {/* ── SOURCE ROW (fixed, not draggable) ── */}
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl"
              style={{ backgroundColor: "#3b82f6" }}
            />

            {/* Lock icon (not draggable) */}
            <div
              className="w-5 flex items-center justify-center shrink-0"
              style={{ color: "#60a5fa" }}
            >
              <Lock size={12} />
            </div>

            {/* SOURCE badge */}
            <div
              className="flex items-center gap-1.5 shrink-0 rounded-md px-2 py-1"
              style={{ backgroundColor: "#dbeafe", border: "1px solid #93c5fd" }}
            >
              <GitBranch size={11} style={{ color: "#2563eb" }} />
              <span
                style={{
                  color: "#2563eb",
                  fontSize: "9px",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                }}
              >
                SOURCE
              </span>
            </div>

            {/* Name — read-only display */}
            <div className="flex-1">
              <div
                className="rounded-lg px-2.5 py-1.5"
                style={{
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  color: "#1f2937",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                Source Repository
              </div>
            </div>

            {/* Path — editable */}
            <div className="flex-1 flex items-center gap-1.5">
              <input
                type="text"
                data-testid="settings-source-path-input"
                value={localSource.path}
                onChange={(e) =>
                  setLocalSource({ ...localSource, path: e.target.value })
                }
                className="flex-1 rounded-lg px-2.5 py-1.5 outline-none transition-all"
                style={{
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  color: "#4b5563",
                  fontFamily: "'SF Mono', monospace",
                  fontSize: "11px",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3b82f6";
                  e.target.style.color = "#1f2937";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.color = "#4b5563";
                }}
              />
              <button
                onClick={async () => {
                  const selectedPath = await onBrowseSource(localSource.path);
                  if (selectedPath) {
                    setLocalSource({ ...localSource, path: selectedPath });
                  }
                }}
                className="p-1.5 rounded-lg cursor-pointer transition-all shrink-0 hover:bg-gray-100"
                style={{
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  color: "#6b7280",
                }}
                title="Browse…"
              >
                <FolderOpen size={11} />
              </button>
            </div>

            {/* No delete — empty spacer */}
            <div className="w-7 h-7 shrink-0" />
          </div>

          {/* ── Separator ── */}
          <div className="flex items-center gap-2 py-1">
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: "#e5e7eb" }}
            />
            <span
              style={{
                color: "#6b7280",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Sync Destinations
            </span>
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: "#e5e7eb" }}
            />
          </div>

          {/* ── Slot Rows (draggable) ── */}
          {localSlots.map((slot, index) => {
            const isDragging = dragIndex === index;
            const isDragOver =
              dragOverIndex === index && dragIndex !== index;

            return (
              <div
                key={slot.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
                style={{
                  backgroundColor: isDragOver
                    ? "#f3f4f6"
                    : isDragging
                    ? "#f9fafb"
                    : "#ffffff",
                  border: `1px solid ${
                    isDragOver
                      ? "#d1d5db"
                      : isDragging
                      ? "#e5e7eb"
                      : "#e5e7eb"
                  }`,
                  opacity: isDragging ? 0.5 : 1,
                  transform: isDragOver ? "scale(1.01)" : "scale(1)",
                  cursor: "grab",
                }}
              >
                {/* Drag Handle */}
                <div
                  style={{ color: "#9ca3af", cursor: "grab", width: 20, display: "flex", justifyContent: "center" }}
                >
                  <GripVertical size={14} />
                </div>

                {/* Color Dot / Picker */}
                <div className="relative shrink-0">
                  <button
                    className="w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200"
                    style={{
                      backgroundColor: slot.color,
                      borderColor: `${slot.color}88`,
                      boxShadow: `0 0 8px ${slot.color}44`,
                    }}
                    onClick={() =>
                      setActiveColorPicker(
                        activeColorPicker === slot.id ? null : slot.id
                      )
                    }
                  />
                  {activeColorPicker === slot.id && (
                    <div
                      className="absolute top-7 left-0 z-10 rounded-xl p-2.5 grid gap-1.5"
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e5e7eb",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      }}
                    >
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor:
                              slot.color === c ? "#ffffff88" : "transparent",
                          }}
                          onClick={() => {
                            updateSlot(slot.id, "color", c);
                            updateSlot(slot.id, "dotColor", c);
                            setActiveColorPicker(null);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Name Input */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={slot.name}
                    onChange={(e) => {
                      updateSlot(slot.id, "name", e.target.value);
                      const label = e.target.value
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      updateSlot(slot.id, "shortLabel", label || "??");
                    }}
                    className="w-full rounded-lg px-2.5 py-1.5 outline-none transition-all"
                    style={{
                      backgroundColor: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      color: "#1f2937",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = `${slot.color}`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                    }}
                  />
                </div>

                {/* Path Input */}
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={slot.filePath}
                    onChange={(e) =>
                      updateSlot(slot.id, "filePath", e.target.value)
                    }
                    className="flex-1 rounded-lg px-2.5 py-1.5 outline-none transition-all"
                    style={{
                      backgroundColor: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      color: "#6b7280",
                      fontFamily: "'SF Mono', monospace",
                      fontSize: "11px",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = `${slot.color}`;
                      e.target.style.color = "#1f2937";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.color = "#6b7280";
                    }}
                  />
                  <button
                    onClick={async () => {
                      const selectedPath = await onBrowseSlot(slot.id, slot.filePath);
                      if (selectedPath) {
                        updateSlot(slot.id, "filePath", selectedPath);
                      }
                    }}
                    className="p-1.5 rounded-lg cursor-pointer transition-all shrink-0 hover:bg-gray-100"
                    style={{
                      backgroundColor: "#f3f4f6",
                      border: "1px solid #e5e7eb",
                      color: "#6b7280",
                    }}
                    title="Browse…"
                  >
                    <FolderOpen size={11} />
                  </button>
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeSlot(slot.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0"
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid transparent",
                    color: "#9ca3af",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fef2f2";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca";
                    (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af";
                  }}
                  title="Remove slot"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-3">
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
            <div>
              <p
                style={{
                  color: "#111827",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                关闭按钮最小化到托盘
              </p>
              <p
                style={{
                  color: "#6b7280",
                  fontSize: "11px",
                  marginTop: 2,
                }}
              >
                启用后，点击关闭按钮或按 Alt+F4 会隐藏到托盘，而不是直接退出应用。
              </p>
            </div>
            <label
              className="flex cursor-pointer items-center gap-2"
              style={{ color: "#4b5563" }}
            >
              <input
                type="checkbox"
                checked={localPreferences.closeToTray}
                onChange={(event) =>
                  setLocalPreferences((previous) => ({
                    ...previous,
                    closeToTray: event.target.checked,
                  }))
                }
              />
              <span style={{ fontSize: "11px", fontWeight: 600 }}>
                {localPreferences.closeToTray ? "已启用" : "已关闭"}
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={addSlot}
              className="flex items-center gap-2 rounded-xl px-4 py-2 cursor-pointer transition-all duration-200 hover:bg-gray-50"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                color: "#6b7280",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <Plus size={13} />
              Add Destination
            </button>
            {error && (
              <span style={{ color: "#dc2626", fontSize: "11px" }}>
                {error}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 cursor-pointer transition-all border border-gray-300 hover:bg-gray-50"
              style={{
                backgroundColor: "#ffffff",
                color: "#4b5563",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              取消
            </button>
            <button
              onClick={() => void handleSave()}
              data-testid="settings-save-button"
              className="flex items-center gap-2 rounded-xl px-5 py-2 cursor-pointer transition-all duration-200 border"
              style={{
                backgroundColor: saved ? "#10b981" : "#2563eb",
                border: `1px solid ${saved ? "#10b981" : "#2563eb"}`,
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              {saved ? <Check size={13} /> : <Save size={13} />}
              {saved ? "已保存" : "保存更改"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
