import { useMemo, useState } from "react";
import { Check, ClipboardCopy, Trash2, X } from "lucide-react";
import type { OperationLogEntry } from "@/types/electron";

interface OperationLogModalProps {
  entries: OperationLogEntry[];
  onClose: () => void;
  onClear: () => Promise<void> | void;
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return parsed.toLocaleString("zh-CN", {
    hour12: false,
  });
}

function formatLogText(entries: OperationLogEntry[]): string {
  return entries
    .map((entry) => {
      const header = `[${formatTimestamp(entry.timestamp)}] ${entry.level.toUpperCase()} ${entry.scope}`;
      return entry.details ? `${header}\n${entry.message}\n${entry.details}` : `${header}\n${entry.message}`;
    })
    .join("\n\n");
}

function getLevelStyles(level: OperationLogEntry["level"]) {
  switch (level) {
    case "success":
      return {
        badgeBackground: "#dcfce7",
        badgeBorder: "#86efac",
        badgeColor: "#166534",
      };
    case "warning":
      return {
        badgeBackground: "#fef3c7",
        badgeBorder: "#fcd34d",
        badgeColor: "#92400e",
      };
    case "error":
      return {
        badgeBackground: "#fee2e2",
        badgeBorder: "#fca5a5",
        badgeColor: "#991b1b",
      };
    default:
      return {
        badgeBackground: "#dbeafe",
        badgeBorder: "#93c5fd",
        badgeColor: "#1d4ed8",
      };
  }
}

export function OperationLogModal({ entries, onClose, onClear }: OperationLogModalProps) {
  const [copied, setCopied] = useState(false);
  const formattedText = useMemo(() => formatLogText(entries), [entries]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      data-testid="operation-log-modal"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[82vh] w-[760px] flex-col overflow-hidden rounded-2xl"
        style={{
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
          <div>
            <h2 style={{ color: "#111827", fontWeight: 600, fontSize: "14px" }}>
              操作日志
            </h2>
            <p style={{ color: "#6b7280", fontSize: "11px" }}>
              仅保留最近一段时间的成功流水和失败详情，长度会自动裁剪。
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 transition-all hover:bg-gray-50"
            style={{ backgroundColor: "#ffffff", color: "#4b5563" }}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="flex shrink-0 items-center justify-between gap-3 px-6 py-3"
          style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}
        >
          <span style={{ color: "#6b7280", fontSize: "11px" }}>
            当前显示 {entries.length} 条
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onClear()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 transition-all hover:bg-gray-50"
              style={{ color: "#4b5563", fontSize: "11px", fontWeight: 500 }}
            >
              <Trash2 size={12} />
              清空
            </button>
            <button
              onClick={() => void handleCopy()}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-all"
              style={{
                backgroundColor: copied ? "#10b981" : "#2563eb",
                borderColor: copied ? "#10b981" : "#2563eb",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
              {copied ? "已复制" : "复制文本"}
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{
            backgroundColor: "#0f172a",
            scrollbarWidth: "thin",
            scrollbarColor: "#475569 transparent",
          }}
        >
          {entries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p style={{ color: "#94a3b8", fontSize: "12px" }}>暂无操作日志</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const levelStyles = getLevelStyles(entry.level);

                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border px-4 py-3"
                    style={{
                      borderColor: "#1e293b",
                      backgroundColor: "#111827",
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: levelStyles.badgeBackground,
                            border: `1px solid ${levelStyles.badgeBorder}`,
                            color: levelStyles.badgeColor,
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {entry.level}
                        </span>
                        <span
                          style={{
                            color: "#cbd5e1",
                            fontSize: "10px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {entry.scope}
                        </span>
                      </div>
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: "10px",
                          fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                        }}
                      >
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>

                    <div
                      style={{
                        color: "#f8fafc",
                        fontSize: "12px",
                        lineHeight: "1.7",
                        fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {entry.message}
                      {entry.details ? `\n${entry.details}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
