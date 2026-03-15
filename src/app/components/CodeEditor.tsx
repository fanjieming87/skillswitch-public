import type { ReactNode } from "react";
import { FileCode, GitBranch, Lock, Trash2 } from "lucide-react";
import type { Slot, SkillPackage } from "./types";

interface CodeEditorProps {
  file: SkillPackage;
  allSlots: Slot[];
  activeFilters: string[];
  previewContent: string;
  previewPath: string;
  previewRootPath: string;
  previewLastModified: string;
  previewLoading?: boolean;
  previewError?: string | null;
  canDelete?: boolean;
  deleteLoading?: boolean;
  onDelete?: () => void;
}

function tokenizeLine(line: string): ReactNode[] {
  const tokens: ReactNode[] = [];

  if (/^\s*#/.test(line)) {
    tokens.push(
      <span key="comment" style={{ color: "#5a6e52", fontStyle: "italic" }}>
        {line}
      </span>,
    );
    return tokens;
  }

  const keyValueMatch = line.match(/^(\s*)([\w_-]+)(:)(\s*)(.*)/);
  if (keyValueMatch) {
    const [, indent, key, colon, space, value] = keyValueMatch;
    tokens.push(<span key="indent">{indent}</span>);
    tokens.push(
      <span key="key" style={{ color: "#7cb8f7" }}>
        {key}
      </span>,
    );
    tokens.push(
      <span key="colon" style={{ color: "#6870a8" }}>
        {colon}
      </span>,
    );
    tokens.push(<span key="space">{space}</span>);

    if (value) {
      if (/^".*"$/.test(value.trim())) {
        tokens.push(
          <span key="value" style={{ color: "#a3c988" }}>
            {value}
          </span>,
        );
      } else if (/^\d+$/.test(value.trim())) {
        tokens.push(
          <span key="value" style={{ color: "#e8a566" }}>
            {value}
          </span>,
        );
      } else if (/^(true|false|null|yes|no)$/.test(value.trim())) {
        tokens.push(
          <span key="value" style={{ color: "#c678dd" }}>
            {value}
          </span>,
        );
      } else if (/^[|>]/.test(value.trim())) {
        tokens.push(
          <span key="value" style={{ color: "#56b6c2" }}>
            {value}
          </span>,
        );
      } else {
        tokens.push(
          <span key="value" style={{ color: "#c8c8d8" }}>
            {value}
          </span>,
        );
      }
    }
    return tokens;
  }

  const listMatch = line.match(/^(\s*)(- )(.*)/);
  if (listMatch) {
    const [, indent, bullet, content] = listMatch;
    tokens.push(<span key="indent">{indent}</span>);
    tokens.push(
      <span key="bullet" style={{ color: "#56b6c2" }}>
        {bullet}
      </span>,
    );
    tokens.push(
      <span
        key="content"
        style={{
          color: /^".*"$/.test(content.trim()) ? "#a3c988" : "#c8c8d8",
        }}
      >
        {content}
      </span>,
    );
    return tokens;
  }

  tokens.push(
    <span key="text" style={{ color: "#9090a8" }}>
      {line}
    </span>,
  );
  return tokens;
}

export function CodeEditor({
  file,
  allSlots,
  activeFilters,
  previewContent,
  previewPath,
  previewRootPath,
  previewLastModified,
  previewLoading = false,
  previewError = null,
  canDelete = false,
  deleteLoading = false,
  onDelete,
}: CodeEditorProps) {
  const previewFileName = previewPath.split(/[/\\]/).pop() ?? "skill.md";

  const lines = previewContent.split("\n");
  const activeSlots = file.slots.filter((slot) => slot.active);
  const displayedSlots =
    activeFilters.length > 0
      ? activeFilters[0] === "source"
        ? activeSlots
        : activeSlots.filter((slot) => slot.slotId === activeFilters[0])
      : activeSlots;

  const totalSlots = file.slots.length;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#ffffff" }}>
      <div
        className="flex shrink-0 items-center justify-between px-5 py-3"
        style={{
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#1e1e2e" }}
          >
            <FileCode size={14} style={{ color: "#6870a8" }} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  color: "#1f2937",
                  fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                {file.name}
              </span>
              <span
                className="rounded-full px-2 py-0.5"
                style={{
                  backgroundColor: "#e5e7eb",
                  color: "#4b5563",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                skill.md
              </span>
              <div
                className="h-1 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: "#e5e7eb" }}
              />
              <span style={{ color: "#9ca3af", fontSize: "10px" }}>{previewLastModified}</span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {displayedSlots.length === 0 ? (
                <span style={{ color: "#9ca3af", fontSize: "10px", fontStyle: "italic" }}>
                  No active slots
                </span>
              ) : (
                displayedSlots.map((activeSlot) => {
                  const slot = allSlots.find((item) => item.id === activeSlot.slotId);
                  if (!slot) {
                    return null;
                  }

                  return (
                    <span
                      key={activeSlot.slotId}
                      className="inline-flex items-center rounded-md px-2 py-0.5"
                      style={{
                        backgroundColor: slot.color,
                        border: `1px solid ${slot.color}`,
                        color: "#ffffff",
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.01em",
                      }}
                    >
                      {slot.name}
                    </span>
                  );
                })
              )}
              <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                ({displayedSlots.length}/{totalSlots})
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5"
            style={{
              backgroundColor: "#ffffff",
              borderColor: "#e5e7eb",
              color: "#4b5563",
              fontSize: "11px",
              fontWeight: 500,
            }}
            title="Read only preview"
          >
            <Lock size={11} />
            Read only
          </div>

          {canDelete && onDelete ? (
            <button
              onClick={onDelete}
              data-testid="preview-delete-button"
              disabled={deleteLoading}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                backgroundColor: "#fef2f2",
                borderColor: "#fecaca",
                color: "#b91c1c",
                fontSize: "11px",
                fontWeight: 600,
              }}
              title="永久删除当前槽位中的技能目录"
            >
              <Trash2 size={11} />
              {deleteLoading ? "删除中..." : "删除"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-2 px-5 py-1.5"
        style={{
          backgroundColor: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <GitBranch size={10} style={{ color: "#93c5fd" }} />
        <span
          style={{
            color: "#6b7280",
            fontSize: "10px",
            fontFamily: "'SF Mono', monospace",
          }}
        >
          {previewRootPath}
        </span>
        <span style={{ color: "#1e2a38", fontSize: "10px" }}>/</span>
        <span
          style={{
            color: "#3a5a80",
            fontSize: "10px",
            fontFamily: "'SF Mono', monospace",
          }}
        >
          {file.name}
        </span>
        <span style={{ color: "#1e2a38", fontSize: "10px" }}>/</span>
        <span
          style={{
            color: "#3a5a80",
            fontSize: "10px",
            fontFamily: "'SF Mono', monospace",
          }}
        >
          {previewFileName}
        </span>
      </div>

      <div
        data-testid="code-editor"
        className="flex-1 overflow-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#d1d5db",
          backgroundColor: "#1f2937",
        }}
      >
        <table
          className="w-full border-collapse"
          style={{
            fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
            tableLayout: "fixed",
          }}
        >
          <tbody>
            {previewLoading ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-6"
                  style={{ color: "#9ca3af", fontSize: "12px" }}
                >
                  Loading preview...
                </td>
              </tr>
            ) : previewError ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-6"
                  style={{ color: "#fca5a5", fontSize: "12px", whiteSpace: "pre-wrap" }}
                >
                  {previewError}
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr key={index} className="group transition-colors hover:bg-white/[0.018]">
                  <td
                    className="select-none align-top pr-2 pl-0 text-right"
                    style={{
                      color: "#9ca3af",
                      fontSize: "11px",
                      lineHeight: "1.8",
                      width: "44px",
                      minWidth: "44px",
                      maxWidth: "44px",
                      userSelect: "none",
                      borderRight: "1px solid #374151",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {index + 1}
                  </td>

                  <td
                    className="whitespace-pre pl-3 pr-6 align-top"
                    style={{ fontSize: "12.5px", lineHeight: "1.8" }}
                  >
                    {tokenizeLine(line)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        className="flex shrink-0 items-center justify-between px-5 py-1.5"
        style={{
          borderTop: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
        }}
      >
        <div className="flex items-center gap-4">
          <span style={{ color: "#6b7280", fontSize: "10px" }}>skill.md</span>
          <span style={{ color: "#6b7280", fontSize: "10px" }}>UTF-8</span>
          <span style={{ color: "#6b7280", fontSize: "10px" }}>{lines.length} lines</span>
        </div>
        <div
          className="flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{ backgroundColor: "#f3f4f6" }}
        >
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#6b7280" }} />
          <span style={{ color: "#6b7280", fontSize: "10px" }}>Read only</span>
        </div>
      </div>
    </div>
  );
}
