import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { Slot, SkillPackage, SourceConfig } from "./types";

interface SidebarProps {
  allSlots: Slot[];
  files: SkillPackage[];
  selectedFileId: string | null;
  onSelectFile: (id: string) => void;
  activeFilters: string[];
  onToggleFilter: (id: string) => void;
  sourceConfig: SourceConfig;
}

const MAX_VISIBLE_PILLS = 3;
const VIRTUALIZATION_THRESHOLD = 40;
const VIRTUAL_ROW_HEIGHT = 68;
const VIRTUAL_OVERSCAN = 6;

interface FileSearchMetadata {
  normalizedName: string;
  activeSlotIds: Set<string>;
  isSourceSkill: boolean;
}

function ActiveSlotPills({ file, allSlots }: { file: SkillPackage; allSlots: Slot[] }) {
  const activeAssignments = file.slots.filter((s) => s.active);

  if (activeAssignments.length === 0) {
    return (
      <span
        className="text-[9px]"
        style={{ color: "#2e2e42", fontStyle: "italic" }}
      >
        no active slots
      </span>
    );
  }

  const visible = activeAssignments.slice(0, MAX_VISIBLE_PILLS);
  const overflow = activeAssignments.length - visible.length;

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
      {visible.map((assignment) => {
        const slot = allSlots.find((s) => s.id === assignment.slotId);
        if (!slot) return null;
        return (
          <span
            key={assignment.slotId}
            className="inline-flex shrink-0 items-center rounded-full select-none"
            style={{
              backgroundColor: `${slot.color}22`,
              border: `1px solid ${slot.color}55`,
              color: slot.color,
              padding: "1px 7px",
              fontSize: "9.5px",
              fontWeight: 600,
              letterSpacing: "0.01em",
              lineHeight: "1.6",
            }}
          >
            {slot.name}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className="inline-flex items-center rounded-full select-none"
          style={{
            backgroundColor: "#1e1e2a",
            border: "1px solid #2a2a3a",
            color: "#4a4a5a",
            padding: "1px 6px",
            fontSize: "9px",
            fontWeight: 600,
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

function AIFilterButton({
  slot,
  active,
  onToggle,
}: {
  slot: Slot;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={slot.name}
      className="flex items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-105"
      style={{
        padding: "6px 12px",
        borderRadius: "8px",
        backgroundColor: active ? slot.color : "#ffffff",
        border: `1px solid ${active ? slot.color : "#e5e7eb"}`,
        color: active ? "#ffffff" : slot.color,
        fontWeight: 600,
        fontSize: "11px",
        boxShadow: active ? `0 2px 4px ${slot.color}33` : "none",
      }}
    >
      {/* Color indicator dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: active ? "#ffffff" : slot.color,
        }}
      />
      <span style={{ fontSize: "11px", fontWeight: 600 }}>
        {slot.name}
      </span>
    </button>
  );
}

export function Sidebar({
  allSlots,
  files,
  selectedFileId,
  onSelectFile,
  activeFilters,
  onToggleFilter,
  sourceConfig,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileMetadataCacheRef = useRef<WeakMap<SkillPackage, FileSearchMetadata>>(new WeakMap());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const selectedFilter = activeFilters[0];

  const getFileMetadata = (file: SkillPackage): FileSearchMetadata => {
    const cached = fileMetadataCacheRef.current.get(file);
    if (cached) {
      return cached;
    }

    const metadata = {
      normalizedName: file.name.toLowerCase(),
      activeSlotIds: new Set(file.slots.filter((slot) => slot.active).map((slot) => slot.slotId)),
      isSourceSkill: Boolean(file.packagePath && file.previewPath),
    } satisfies FileSearchMetadata;
    fileMetadataCacheRef.current.set(file, metadata);
    return metadata;
  };

  const filtered = files.filter((f) => {
    const metadata = getFileMetadata(f);
    const matchesSearch =
      normalizedSearch === "" || metadata.normalizedName.includes(normalizedSearch);
    const matchesFilter =
      activeFilters.length === 0 ||
      !selectedFilter ||
      (selectedFilter === "source"
        ? metadata.isSourceSkill
        : metadata.activeSlotIds.has(selectedFilter));

    return matchesSearch && matchesFilter;
  });

  const shouldVirtualize = filtered.length > VIRTUALIZATION_THRESHOLD;
  const effectiveViewportHeight = viewportHeight > 0 ? viewportHeight : VIRTUAL_ROW_HEIGHT * 10;
  const visibleCount = shouldVirtualize
    ? Math.ceil(effectiveViewportHeight / VIRTUAL_ROW_HEIGHT)
    : filtered.length;
  const startIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN)
    : 0;
  const endIndex = shouldVirtualize
    ? Math.min(filtered.length, startIndex + visibleCount + VIRTUAL_OVERSCAN * 2)
    : filtered.length;
  const visibleFiles = filtered.slice(startIndex, endIndex);
  const virtualPaddingTop = shouldVirtualize ? startIndex * VIRTUAL_ROW_HEIGHT : 0;
  const virtualPaddingBottom = shouldVirtualize
    ? Math.max(0, (filtered.length - endIndex) * VIRTUAL_ROW_HEIGHT)
    : 0;

  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(listRef.current?.clientHeight ?? 0);
    };

    updateViewportHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && listRef.current
        ? new ResizeObserver(() => {
            updateViewportHeight();
          })
        : null;

    if (listRef.current && resizeObserver) {
      resizeObserver.observe(listRef.current);
    }

    window.addEventListener("resize", updateViewportHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [normalizedSearch, selectedFilter, files]);

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 264,
        minWidth: 264,
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e5e7eb",
      }}
    >
      {/* Search */}
      <div className="px-3 pt-4 pb-3">
        <div className="relative flex items-center">
          <Search
            size={12}
            className="absolute left-3 pointer-events-none"
            style={{ color: "#9ca3af" }}
          />
          <input
            type="text"
            placeholder="搜索技能..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg pl-8 pr-8 py-2 outline-none transition-all"
            style={{
              backgroundColor: "#f3f4f6",
              border: "1px solid #e5e7eb",
              color: "#1f2937",
              fontSize: "12px",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 p-0.5 rounded cursor-pointer"
              style={{ color: "#9ca3af" }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Icons */}
      <div className="px-3 pb-4">
        <div
          className="rounded-xl p-3"
          style={{ 
            backgroundColor: "#f9fafb", 
            border: "1px solid #e5e7eb" 
          }}
        >
          <p
            className="text-[9px] uppercase tracking-widest mb-3"
            style={{ color: "#6b7280", fontWeight: 700 }}
          >
            Filter by tool
          </p>
          <div className="flex items-start gap-2 flex-wrap">
            {/* Render all slots in order (source first, then custom slots) */}
            {allSlots.map((slot) => (
              <AIFilterButton
                key={slot.id}
                slot={slot}
                active={activeFilters.includes(slot.id)}
                onToggle={() => onToggleFilter(slot.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div
        className="mx-3 mb-2"
        style={{ height: 1, backgroundColor: "#e5e7eb" }}
      />

      {/* Skill Count */}
      <div className="px-4 mb-2 flex items-center justify-between">
        <span
          className="text-[9px] uppercase tracking-widest"
          style={{ color: "#6b7280", fontWeight: 700 }}
        >
          Skills
        </span>
        <span
          className="text-[9px] rounded-full px-2 py-0.5"
          style={{
            backgroundColor: "#f3f4f6",
            color: "#6b7280",
            fontWeight: 600,
          }}
        >
          {filtered.length}
        </span>
      </div>

      {/* Skill List */}
      <div
        ref={listRef}
        data-testid="sidebar-skill-list"
        onScroll={(event) => {
          if (!shouldVirtualize) {
            return;
          }

          setScrollTop(event.currentTarget.scrollTop);
        }}
        className="flex-1 overflow-y-auto px-2 pb-4"
        style={{ 
          scrollbarWidth: "thin", 
          scrollbarColor: "#d1d5db",
          backgroundColor: "transparent"
        }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#f3f4f6" }}
            >
              <Search size={13} style={{ color: "#9ca3af" }} />
            </div>
            <p className="text-xs text-center" style={{ color: "#6b7280" }}>
              No skills found
            </p>
          </div>
        ) : (
          <div
            style={{
              paddingTop: virtualPaddingTop,
              paddingBottom: virtualPaddingBottom,
            }}
          >
            {visibleFiles.map((file) => {
              const isSelected = file.id === selectedFileId;
              return (
                <button
                  key={file.id}
                  onClick={() => onSelectFile(file.id)}
                  data-testid={`skill-item-${file.name}`}
                  className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left transition-all duration-150 block"
                  style={{
                    minHeight: VIRTUAL_ROW_HEIGHT,
                    backgroundColor: isSelected 
                      ? "#eff6ff" 
                      : "transparent",
                    border: `1px solid ${isSelected 
                      ? "#bfdbfe" 
                      : "transparent"}`,
                  }}
                >
                  {/* Skill directory name */}
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className="truncate pr-2"
                      title={file.name}
                      style={{
                        color: isSelected 
                          ? "#1f2937" 
                          : "#6b7280",
                        fontFamily:
                          "'SF Mono', 'JetBrains Mono', monospace",
                        fontWeight: isSelected ? 500 : 400,
                        fontSize: "11.5px",
                      }}
                    >
                      {file.name}
                    </span>
                    <span
                      className="shrink-0"
                      style={{ color: "#9ca3af", fontSize: "9px" }}
                    >
                      {file.lastModified}
                    </span>
                  </div>

                  {/* Active Slot Pills — full names */}
                  <ActiveSlotPills file={file} allSlots={allSlots} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
