import log from "electron-log/main";
import type { OperationLogEntry } from "../services/OperationLogService";

const SUCCESS_PREFIX = "[success]";

let initialized = false;

function joinMessage(message: string, details?: string): string {
  return details ? `${message}\n${details}` : message;
}

export function initializeDiagnosticLogger(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  log.initialize();
  log.scope.labelPadding = false;
  log.transports.file.level = "info";
  log.transports.console.level = process.env.NODE_ENV === "production" ? "info" : "debug";
  log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}";
  log.errorHandler.startCatching({
    showDialog: false,
  });
}

export function getDiagnosticLogger(scope?: string) {
  return scope ? log.scope(scope) : log;
}

export function getDiagnosticLogFilePath(): string | undefined {
  try {
    return log.transports.file.getFile().path;
  } catch {
    return undefined;
  }
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function mirrorOperationLogEntry(entry: OperationLogEntry): void {
  const scopedLogger = log.scope(entry.scope);
  const text = joinMessage(entry.message, entry.details);

  switch (entry.level) {
    case "error":
      scopedLogger.error(text);
      return;
    case "warning":
      scopedLogger.warn(text);
      return;
    case "success":
      scopedLogger.info(`${SUCCESS_PREFIX} ${text}`);
      return;
    default:
      scopedLogger.info(text);
  }
}

export function logIpcHandlerFailure(channel: string, args: unknown[], error: unknown): void {
  const logger = log.scope("ipc");
  const formattedArgs =
    args.length === 0 ? "[]" : formatUnknownError(args).slice(0, 1000);

  logger.error(
    joinMessage(
      `IPC handler failed: ${channel}`,
      `args=${formattedArgs}\n${formatUnknownError(error)}`,
    ),
  );
}
