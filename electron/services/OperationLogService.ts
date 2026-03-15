export type OperationLogLevel = "info" | "success" | "warning" | "error";
export type OperationLogScope = "app" | "sync" | "config" | "file";

export interface OperationLogInput {
  level: OperationLogLevel;
  scope: OperationLogScope;
  message: string;
  details?: string;
}

export interface OperationLogEntry extends OperationLogInput {
  id: string;
  timestamp: string;
}

const MAX_LOG_ENTRIES = 80;
const MAX_LOG_CHARS = 32000;
const MAX_LOG_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGE_CHARS = 240;
const MAX_DETAILS_CHARS = 2000;

type ChangeListener = (() => void) | null;
type EntryMirror = ((entry: OperationLogEntry) => void) | null;

function truncateText(value: string | undefined, maxChars: number): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function estimateEntrySize(entry: OperationLogEntry): number {
  return entry.id.length + entry.timestamp.length + entry.message.length + (entry.details?.length ?? 0) + 24;
}

function buildLogId(nowMs: number): string {
  return `log-${nowMs}-${Math.random().toString(16).slice(2, 10)}`;
}

export class OperationLogService {
  private readonly entries: OperationLogEntry[] = [];

  private changeListener: ChangeListener = null;

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly mirrorEntry: EntryMirror = null,
  ) {}

  setChangeListener(listener: ChangeListener): void {
    this.changeListener = listener;
  }

  append(input: OperationLogInput): OperationLogEntry {
    const nowMs = this.now();
    const entry: OperationLogEntry = {
      id: buildLogId(nowMs),
      timestamp: new Date(nowMs).toISOString(),
      level: input.level,
      scope: input.scope,
      message: truncateText(input.message, MAX_MESSAGE_CHARS) ?? "Log message is empty.",
      details: truncateText(input.details, MAX_DETAILS_CHARS),
    };

    this.entries.push(entry);
    this.trim(nowMs);
    try {
      this.mirrorEntry?.(entry);
    } catch {
      // Diagnostic log persistence is best-effort and must never break the UI log flow.
    }
    this.changeListener?.();
    return entry;
  }

  clear(): void {
    if (this.entries.length === 0) {
      return;
    }

    this.entries.length = 0;
    this.changeListener?.();
  }

  getEntries(): OperationLogEntry[] {
    this.trim(this.now());
    return [...this.entries];
  }

  info(scope: OperationLogScope, message: string, details?: string): OperationLogEntry {
    return this.append({ level: "info", scope, message, details });
  }

  success(scope: OperationLogScope, message: string, details?: string): OperationLogEntry {
    return this.append({ level: "success", scope, message, details });
  }

  warning(scope: OperationLogScope, message: string, details?: string): OperationLogEntry {
    return this.append({ level: "warning", scope, message, details });
  }

  error(scope: OperationLogScope, message: string, details?: string): OperationLogEntry {
    return this.append({ level: "error", scope, message, details });
  }

  private trim(nowMs: number): void {
    const minTimestamp = nowMs - MAX_LOG_AGE_MS;

    while (this.entries.length > 0) {
      const oldestEntry = this.entries[0];
      const oldestMs = Date.parse(oldestEntry.timestamp);
      if (!Number.isFinite(oldestMs) || oldestMs >= minTimestamp) {
        break;
      }

      this.entries.shift();
    }

    while (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.shift();
    }

    let totalChars = this.entries.reduce((sum, entry) => sum + estimateEntrySize(entry), 0);
    while (this.entries.length > 1 && totalChars > MAX_LOG_CHARS) {
      const removed = this.entries.shift();
      if (!removed) {
        break;
      }

      totalChars -= estimateEntrySize(removed);
    }
  }
}
