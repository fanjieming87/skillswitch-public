import { promises as fs } from "fs";
import path from "path";
import { ConfigService } from "./ConfigService";
import { OperationLogService } from "./OperationLogService";
import { pathsEqual, resolveAppPath } from "../utils/path-resolver";

const SKILL_PREVIEW_FILE = "skill.md";
const TEMP_PATH_MARKER = ".__skillswitch_tmp__";
const BACKUP_PATH_MARKER = ".__skillswitch_backup__";

export interface SyncParams {
  sourceDir: string;
  packageIds: string[];
  slotIds: string[];
  allowOverwrite?: boolean;
}

export interface SyncConflict {
  packageName: string;
  slotId: string;
  targetPath: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  conflicts: SyncConflict[];
  requiresOverwriteConfirmation: boolean;
}

export interface SyncItemResult {
  packageName: string;
  slotId: string;
  targetPath: string;
  status: "copied" | "skipped" | "failed";
  message?: string;
}

export interface SyncResult {
  total: number;
  copied: number;
  skipped: number;
  failed: number;
  items: SyncItemResult[];
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryHasSkillPreview(directoryPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(directoryPath, SKILL_PREVIEW_FILE));
    return stat.isFile();
  } catch {
    return false;
  }
}

function isDirectChildOf(sourceDir: string, targetPath: string): boolean {
  const relative = path.relative(sourceDir, targetPath);
  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative) &&
    !relative.includes(path.sep)
  );
}

function createTempTargetPath(targetDir: string, packageName: string): string {
  const uniqueSuffix = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
  return path.join(
    targetDir,
    `${packageName}${TEMP_PATH_MARKER}${uniqueSuffix}`,
  );
}

function createBackupTargetPath(targetDir: string, packageName: string): string {
  const uniqueSuffix = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
  return path.join(
    targetDir,
    `${packageName}${BACKUP_PATH_MARKER}${uniqueSuffix}`,
  );
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown sync failure.";
}

interface SyncExecutionPaths {
  targetPackagePath: string;
  tempTargetPath: string;
  backupTargetPath?: string;
}

export class SyncService {
  constructor(
    private readonly configService: ConfigService,
    private readonly operationLogService?: OperationLogService,
  ) {}

  private logInfo(message: string, details?: string): void {
    this.operationLogService?.info("sync", message, details);
  }

  private logSuccess(message: string, details?: string): void {
    this.operationLogService?.success("sync", message, details);
  }

  private logWarning(message: string, details?: string): void {
    this.operationLogService?.warning("sync", message, details);
  }

  private logError(message: string, details?: string): void {
    this.operationLogService?.error("sync", message, details);
  }

  private async removeCurrentRunPath(targetPath: string, label: string): Promise<string | undefined> {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return undefined;
    } catch (error) {
      return `Failed to remove ${label}: ${targetPath}\n${formatErrorMessage(error)}`;
    }
  }

  private async rollbackSync({
    targetPackagePath,
    tempTargetPath,
    backupTargetPath,
  }: Required<Pick<SyncExecutionPaths, "targetPackagePath" | "tempTargetPath" | "backupTargetPath">>): Promise<string> {
    const details: string[] = [];
    const tempCleanupMessage = await this.removeCurrentRunPath(tempTargetPath, "temporary sync directory");
    if (tempCleanupMessage) {
      details.push(tempCleanupMessage);
    }

    const backupExists = await pathExists(backupTargetPath);
    if (!backupExists) {
      const message = [
        "Rollback could not restore the original target because the backup directory was missing.",
        `target=${targetPackagePath}`,
        `backup=${backupTargetPath}`,
        ...details,
      ].join("\n");
      this.logError("Rollback failed because the backup directory was missing.", message);
      return message;
    }

    try {
      if (await pathExists(targetPackagePath)) {
        await fs.rm(targetPackagePath, { recursive: true, force: true });
      }

      await fs.rename(backupTargetPath, targetPackagePath);
      const message = [
        "Original target directory was restored from backup.",
        `target=${targetPackagePath}`,
        `backup=${backupTargetPath}`,
        ...details,
      ].join("\n");
      this.logWarning("Rollback restored the original target directory.", message);
      return message;
    } catch (error) {
      const message = [
        `Rollback failed. Backup directory was kept at: ${backupTargetPath}`,
        `target=${targetPackagePath}`,
        formatErrorMessage(error),
        ...details,
      ].join("\n");
      this.logError("Rollback failed for a sync item.", message);
      return message;
    }
  }

  private async handleBackupPreparationFailure({
    targetPackagePath,
    tempTargetPath,
    backupTargetPath,
  }: Required<Pick<SyncExecutionPaths, "targetPackagePath" | "tempTargetPath" | "backupTargetPath">>, error: unknown): Promise<string> {
    const details: string[] = [formatErrorMessage(error)];
    const tempCleanupMessage = await this.removeCurrentRunPath(tempTargetPath, "temporary sync directory");
    if (tempCleanupMessage) {
      details.push(tempCleanupMessage);
    }

    const targetExists = await pathExists(targetPackagePath);
    const backupExists = await pathExists(backupTargetPath);

    if (targetExists && !backupExists) {
      const message = [
        "Unable to create backup before overwrite.",
        "Original target directory was left unchanged.",
        `target=${targetPackagePath}`,
        ...details,
      ].join("\n");
      this.logError("Failed to create an overwrite backup; original target was left unchanged.", message);
      return message;
    }

    if (!targetExists && backupExists) {
      try {
        await fs.rename(backupTargetPath, targetPackagePath);
        const message = [
          "Backup creation reported failure after the original target had been moved.",
          "The original target directory was restored.",
          `target=${targetPackagePath}`,
          `backup=${backupTargetPath}`,
          ...details,
        ].join("\n");
        this.logWarning("Backup creation failed, but the original target directory was restored.", message);
        return message;
      } catch (restoreError) {
        const message = [
          "Backup creation failed after the original target had been moved.",
          `Backup directory was kept at: ${backupTargetPath}`,
          `target=${targetPackagePath}`,
          ...details,
          formatErrorMessage(restoreError),
        ].join("\n");
        this.logError("Backup creation failed and the original target could not be restored automatically.", message);
        return message;
      }
    }

    const message = [
      "Unable to create backup before overwrite.",
      "Target state is inconsistent and requires manual inspection.",
      `target=${targetPackagePath}`,
      `backup=${backupTargetPath}`,
      `targetExists=${targetExists ? "true" : "false"}`,
      `backupExists=${backupExists ? "true" : "false"}`,
      ...details,
    ].join("\n");
    this.logError("Backup creation failed and left the target in an unexpected state.", message);
    return message;
  }

  async validateSync(params: SyncParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const conflicts: SyncConflict[] = [];
    const sourceDir = resolveAppPath(params.sourceDir);
    const config = this.configService.get();

    try {
      const stat = await fs.stat(sourceDir);
      if (!stat.isDirectory()) {
        errors.push(`Source path is not a directory: ${sourceDir}`);
      }
    } catch {
      errors.push(`Source directory does not exist: ${sourceDir}`);
    }

    if (params.packageIds.length === 0) {
      errors.push("Select at least one skill package.");
    }

    if (params.slotIds.length === 0) {
      errors.push("Select at least one destination slot.");
    }

    const selectedPackages = await Promise.all(
      params.packageIds.map(async (packageId) => {
        const packagePath = resolveAppPath(packageId);
        const packageName = path.basename(packagePath);

        if (!packagePath) {
          errors.push("Invalid skill package path.");
          return null;
        }

        if (!isDirectChildOf(sourceDir, packagePath)) {
          errors.push(`Skill package is outside the source directory: ${packagePath}`);
          return null;
        }

        try {
          const stat = await fs.stat(packagePath);
          if (!stat.isDirectory()) {
            errors.push(`Skill package is not a directory: ${packagePath}`);
            return null;
          }
        } catch {
          errors.push(`Skill package does not exist: ${packagePath}`);
          return null;
        }

        if (!(await directoryHasSkillPreview(packagePath))) {
          errors.push(`Missing ${SKILL_PREVIEW_FILE} in skill package: ${packagePath}`);
          return null;
        }

        return {
          packagePath,
          packageName,
        };
      }),
    );

    for (const slotId of params.slotIds) {
      const slot = config.slots.find((candidate) => candidate.id === slotId);
      if (!slot) {
        errors.push(`Unknown slot: ${slotId}`);
        continue;
      }

      const targetDir = resolveAppPath(slot.filePath);
      if (!targetDir) {
        errors.push(`Destination path is empty for slot: ${slot.name}`);
        continue;
      }

      for (const selectedPackage of selectedPackages) {
        if (!selectedPackage) {
          continue;
        }

        const targetPackagePath = path.join(targetDir, selectedPackage.packageName);
        if (pathsEqual(selectedPackage.packagePath, targetPackagePath)) {
          continue;
        }

        if (await pathExists(targetPackagePath)) {
          conflicts.push({
            packageName: selectedPackage.packageName,
            slotId,
            targetPath: targetPackagePath,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      conflicts,
      requiresOverwriteConfirmation: conflicts.length > 0,
    };
  }

  async syncToSlots(params: SyncParams): Promise<SyncResult> {
    this.logInfo(
      `Starting sync run for ${params.packageIds.length} skill directory entries into ${params.slotIds.length} slot(s).`,
      `sourceDir=${params.sourceDir}\nallowOverwrite=${params.allowOverwrite ? "true" : "false"}`,
    );

    const validation = await this.validateSync(params);
    if (!validation.valid) {
      this.logError("Sync request failed validation.", validation.errors.join("\n"));
      throw new Error(validation.errors.join("\n"));
    }

    if (validation.requiresOverwriteConfirmation && !params.allowOverwrite) {
      this.logWarning(
        "Sync request requires overwrite confirmation before execution.",
        validation.conflicts
          .map(
            (conflict) =>
              `${conflict.packageName} -> ${conflict.slotId}\n${conflict.targetPath}`,
          )
          .join("\n\n"),
      );
      throw new Error("Overwrite confirmation required before replacing existing skill directories.");
    }

    const config = this.configService.get();
    const items: SyncItemResult[] = [];

    for (const packageId of params.packageIds) {
      const sourcePackagePath = resolveAppPath(packageId);
      const packageName = path.basename(sourcePackagePath);

      for (const slotId of params.slotIds) {
        const slot = config.slots.find((candidate) => candidate.id === slotId);
        if (!slot) {
          const failedItem = {
            packageName,
            slotId,
            targetPath: "",
            status: "failed",
            message: "Slot configuration not found.",
          } satisfies SyncItemResult;
          items.push(failedItem);
          this.logError(
            `Failed ${packageName} -> ${slotId}`,
            failedItem.message,
          );
          continue;
        }

        const targetDir = resolveAppPath(slot.filePath);
        const targetPackagePath = path.join(targetDir, packageName);

        if (pathsEqual(sourcePackagePath, targetPackagePath)) {
          const skippedItem = {
            packageName,
            slotId,
            targetPath: targetPackagePath,
            status: "skipped",
            message: "Source and destination are the same path.",
          } satisfies SyncItemResult;
          items.push(skippedItem);
          this.logWarning(
            `Skipped ${packageName} -> ${slot.name}`,
            `${skippedItem.message}\n${targetPackagePath}`,
          );
          continue;
        }

        const tempTargetPath = createTempTargetPath(targetDir, packageName);
        const overwrite = await pathExists(targetPackagePath);
        const backupTargetPath = overwrite
          ? createBackupTargetPath(targetDir, packageName)
          : undefined;

        try {
          await fs.mkdir(targetDir, { recursive: true });
          await fs.rm(tempTargetPath, { recursive: true, force: true });
          await fs.cp(sourcePackagePath, tempTargetPath, {
            recursive: true,
            force: true,
          });

          if (overwrite) {
            try {
              await fs.rename(targetPackagePath, backupTargetPath!);
            } catch (error) {
              throw new Error(
                await this.handleBackupPreparationFailure(
                  {
                    targetPackagePath,
                    tempTargetPath,
                    backupTargetPath: backupTargetPath!,
                  },
                  error,
                ),
              );
            }
          }

          try {
            await fs.rename(tempTargetPath, targetPackagePath);
          } catch (error) {
            if (overwrite) {
              throw new Error(
                [
                  formatErrorMessage(error),
                  await this.rollbackSync({
                    targetPackagePath,
                    tempTargetPath,
                    backupTargetPath: backupTargetPath!,
                  }),
                ].join("\n"),
              );
            }

            throw error;
          }

          let copiedMessage = overwrite ? "Overwrote existing skill directory." : undefined;
          if (overwrite) {
            const backupCleanupMessage = await this.removeCurrentRunPath(
              backupTargetPath!,
              "backup directory",
            );
            if (backupCleanupMessage) {
              copiedMessage = [
                copiedMessage,
                backupCleanupMessage,
              ].filter(Boolean).join("\n");
              this.logWarning(
                `Copied ${packageName} -> ${slot.name} with backup cleanup warnings`,
                copiedMessage,
              );
            }
          }

          const copiedItem = {
            packageName,
            slotId,
            targetPath: targetPackagePath,
            status: "copied",
            message: copiedMessage,
          } satisfies SyncItemResult;
          items.push(copiedItem);
          this.logSuccess(
            `Copied ${packageName} -> ${slot.name}`,
            `target=${targetPackagePath}${overwrite ? "\noverwrite=true" : ""}`,
          );
        } catch (error) {
          await fs.rm(tempTargetPath, { recursive: true, force: true }).catch(() => undefined);

          const message = formatErrorMessage(error);
          const failedItem = {
            packageName,
            slotId,
            targetPath: targetPackagePath,
            status: "failed",
            message,
          } satisfies SyncItemResult;
          items.push(failedItem);
          this.logError(
            `Failed ${packageName} -> ${slot.name}`,
            `target=${targetPackagePath}\n${message}`,
          );
        }
      }
    }

    const result = {
      total: items.length,
      copied: items.filter((item) => item.status === "copied").length,
      skipped: items.filter((item) => item.status === "skipped").length,
      failed: items.filter((item) => item.status === "failed").length,
      items,
    } satisfies SyncResult;

    if (result.failed > 0) {
      this.logWarning(
        "Sync run finished with failures.",
        `copied=${result.copied}\nskipped=${result.skipped}\nfailed=${result.failed}`,
      );
    } else {
      this.logSuccess(
        "Sync run finished successfully.",
        `copied=${result.copied}\nskipped=${result.skipped}\nfailed=${result.failed}`,
      );
    }

    return result;
  }
}
