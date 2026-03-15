import { promises as fs, watch, type FSWatcher } from "fs";
import path from "path";
import { BrowserWindow, dialog, type OpenDialogOptions } from "electron";
import { ConfigSlot } from "./ConfigService";
import { resolveAppPath } from "../utils/path-resolver";

const SKILL_PREVIEW_FILE = "skill.md";

export interface SlotAssignment {
  slotId: string;
  active: boolean;
  previewPath?: string;
}

export interface SkillPackage {
  id: string;
  name: string;
  packagePath?: string;
  previewPath?: string;
  previewContent: string;
  lastModified: string;
  slots: SlotAssignment[];
}

export interface SkillPreviewDocument {
  previewPath: string;
  previewContent: string;
  lastModified: string;
}

export interface SourceChangeEvent {
  type: "refresh";
}

interface SkillPackageLocation {
  name: string;
  packagePath: string;
  previewPath: string;
  lastModified: string;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryContainsSkillPreview(directoryPath: string): Promise<boolean> {
  const previewPath = path.join(directoryPath, SKILL_PREVIEW_FILE);
  try {
    const stat = await fs.stat(previewPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function scanSkillPackageLocations(
  rootDir: string,
  options: { throwOnMissing?: boolean } = {},
): Promise<SkillPackageLocation[]> {
  let directoryEntries;
  try {
    directoryEntries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch {
    if (options.throwOnMissing) {
      throw new Error(`Source directory not found: ${rootDir}`);
    }

    return [];
  }

  const skillEntries = directoryEntries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  const packages = await Promise.all(
    skillEntries.map(async (entry) => {
      const packagePath = path.join(rootDir, entry.name);
      if (!(await directoryContainsSkillPreview(packagePath))) {
        return null;
      }

      const previewPath = path.join(packagePath, SKILL_PREVIEW_FILE);
      const stat = await fs.stat(previewPath);

      return {
        name: entry.name,
        packagePath,
        previewPath,
        lastModified: formatRelativeTime(stat.mtimeMs),
      } satisfies SkillPackageLocation;
    }),
  );

  return packages.filter((skillPackage): skillPackage is SkillPackageLocation => skillPackage !== null);
}

export async function resolveNearestExistingDirectory(
  targetPath: string,
): Promise<string | undefined> {
  let currentPath = targetPath;

  while (currentPath) {
    try {
      const stat = await fs.stat(currentPath);
      if (stat.isDirectory()) {
        return currentPath;
      }
    } catch {
      // Keep walking up until we find an existing parent directory.
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return undefined;
    }

    currentPath = parentPath;
  }

  return undefined;
}

function isSameResolvedPath(leftPath: string, rightPath: string): boolean {
  return path.normalize(leftPath).toLowerCase() === path.normalize(rightPath).toLowerCase();
}

export class FileService {
  private stopWatchingSource: (() => void) | null = null;

  resolvePath(targetPath: string): string {
    return resolveAppPath(targetPath);
  }

  async readSkillPackages(dirPath: string, slots: ConfigSlot[] = []): Promise<SkillPackage[]> {
    const resolvedDir = this.resolvePath(dirPath);
    if (!resolvedDir) {
      return [];
    }

    const sourceLocations = await scanSkillPackageLocations(resolvedDir, { throwOnMissing: true });
    const customSlots = slots.filter((slot) => !slot.isSource);
    const slotLocations = await Promise.all(
      customSlots.map(async (slot) => {
        const targetDir = this.resolvePath(slot.filePath);
        if (!targetDir) {
          return [slot.id, []] as const;
        }

        return [slot.id, await scanSkillPackageLocations(targetDir)] as const;
      }),
    );

    const mergedPackages = new Map<
      string,
      {
        sourceLocation?: SkillPackageLocation;
        slotLocations: Map<string, SkillPackageLocation>;
      }
    >();

    const getOrCreatePackage = (skillName: string) => {
      const existing = mergedPackages.get(skillName);
      if (existing) {
        return existing;
      }

      const created: {
        sourceLocation?: SkillPackageLocation;
        slotLocations: Map<string, SkillPackageLocation>;
      } = {
        slotLocations: new Map<string, SkillPackageLocation>(),
      };
      mergedPackages.set(skillName, created);
      return created;
    };

    for (const location of sourceLocations) {
      getOrCreatePackage(location.name).sourceLocation = location;
    }

    for (const [slotId, locations] of slotLocations) {
      for (const location of locations) {
        getOrCreatePackage(location.name).slotLocations.set(slotId, location);
      }
    }

    return Array.from(mergedPackages.entries())
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([skillName, mergedLocation]) => {
        const firstSlotLocation = customSlots
          .map((slot) => mergedLocation.slotLocations.get(slot.id))
          .find((location): location is SkillPackageLocation => Boolean(location));
        const sourceLocation = mergedLocation.sourceLocation;

        return {
          id: sourceLocation?.packagePath ?? `slot:${skillName}`,
          name: skillName,
          ...(sourceLocation
            ? {
                packagePath: sourceLocation.packagePath,
                previewPath: sourceLocation.previewPath,
              }
            : {}),
          previewContent: "",
          lastModified: sourceLocation?.lastModified ?? firstSlotLocation?.lastModified ?? "just now",
          slots: customSlots.map((slot) => {
            const slotLocation = mergedLocation.slotLocations.get(slot.id);
            return {
              slotId: slot.id,
              active: Boolean(slotLocation),
              ...(slotLocation ? { previewPath: slotLocation.previewPath } : {}),
            };
          }),
        } satisfies SkillPackage;
      });
  }

  async readSkillPreview(previewPath: string): Promise<SkillPreviewDocument> {
    const resolvedPreviewPath = this.resolvePath(previewPath);
    if (!resolvedPreviewPath) {
      throw new Error("Skill preview path is empty.");
    }

    if (path.basename(resolvedPreviewPath).toLowerCase() !== SKILL_PREVIEW_FILE) {
      throw new Error(`Preview file must be ${SKILL_PREVIEW_FILE}: ${resolvedPreviewPath}`);
    }

    try {
      const [previewContent, stat] = await Promise.all([
        fs.readFile(resolvedPreviewPath, "utf-8"),
        fs.stat(resolvedPreviewPath),
      ]);

      if (!stat.isFile()) {
        throw new Error(`Preview path is not a file: ${resolvedPreviewPath}`);
      }

      return {
        previewPath: resolvedPreviewPath,
        previewContent,
        lastModified: formatRelativeTime(stat.mtimeMs),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`Failed to read skill preview: ${resolvedPreviewPath}`);
    }
  }

  async deleteSkillDirectory(rootPath: string, skillName: string): Promise<string> {
    const resolvedRootPath = this.resolvePath(rootPath);
    if (!resolvedRootPath) {
      throw new Error("Slot root path is empty.");
    }

    const normalizedSkillName = skillName.trim();
    if (!normalizedSkillName) {
      throw new Error("Skill name is empty.");
    }

    if (
      normalizedSkillName === "." ||
      normalizedSkillName === ".." ||
      path.basename(normalizedSkillName) !== normalizedSkillName
    ) {
      throw new Error(`Skill name must reference a direct child directory: ${skillName}`);
    }

    const resolvedTargetPath = path.resolve(resolvedRootPath, normalizedSkillName);
    if (!isSameResolvedPath(path.dirname(resolvedTargetPath), resolvedRootPath)) {
      throw new Error(`Skill name must reference a direct child directory: ${skillName}`);
    }

    let stat;
    try {
      stat = await fs.stat(resolvedTargetPath);
    } catch {
      throw new Error(`Skill directory not found: ${resolvedTargetPath}`);
    }

    if (!stat.isDirectory()) {
      throw new Error(`Skill path is not a directory: ${resolvedTargetPath}`);
    }

    await fs.rm(resolvedTargetPath, { recursive: true, force: false });
    return resolvedTargetPath;
  }

  async watchSourceDirectory(
    dirPath: string,
    callback: (event: SourceChangeEvent) => void,
    knownPackagePaths: string[] = [],
    slots: ConfigSlot[] = [],
  ): Promise<void> {
    this.unwatchSourceDirectory();

    const resolvedDir = this.resolvePath(dirPath);
    if (!resolvedDir) {
      return;
    }

    try {
      const stat = await fs.stat(resolvedDir);
      if (!stat.isDirectory()) {
        throw new Error(`Source path is not a directory: ${resolvedDir}`);
      }
    } catch {
      throw new Error(`Source directory not found: ${resolvedDir}`);
    }

    const stopWatching = [
      await this.createDirectoryWatcher(resolvedDir, callback, knownPackagePaths, {
        requireExistingDirectory: true,
      }),
    ];

    const customSlotRoots = slots
      .filter((slot) => !slot.isSource)
      .map((slot) => this.resolvePath(slot.filePath))
      .filter((slotPath): slotPath is string => Boolean(slotPath))
      .filter(
        (slotPath, index, allPaths) =>
          !allPaths.slice(0, index).some((existingPath) => isSameResolvedPath(existingPath, slotPath)),
      )
      .filter((slotPath) => !isSameResolvedPath(slotPath, resolvedDir));

    for (const slotPath of customSlotRoots) {
      stopWatching.push(
        await this.createDirectoryWatcher(slotPath, callback, [], {
          requireExistingDirectory: false,
        }),
      );
    }

    this.stopWatchingSource = () => {
      for (const stop of stopWatching) {
        stop();
      }
    };
  }

  unwatchSourceDirectory(): void {
    this.stopWatchingSource?.();
    this.stopWatchingSource = null;
  }

  async selectDirectory(window?: BrowserWindow, defaultPath?: string): Promise<string | null> {
    const options: OpenDialogOptions = {
      properties: ["openDirectory"],
    };

    const resolvedDefaultPath = defaultPath ? this.resolvePath(defaultPath) : "";
    const nearestExistingDirectory = resolvedDefaultPath
      ? await resolveNearestExistingDirectory(resolvedDefaultPath)
      : undefined;

    if (nearestExistingDirectory) {
      options.defaultPath = nearestExistingDirectory;
    }

    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  private async createDirectoryWatcher(
    resolvedDir: string,
    callback: (event: SourceChangeEvent) => void,
    knownPackagePaths: string[] = [],
    options: { requireExistingDirectory?: boolean } = {},
  ): Promise<() => void> {
    if (!options.requireExistingDirectory) {
      try {
        const stat = await fs.stat(resolvedDir);
        if (!stat.isDirectory()) {
          return () => undefined;
        }
      } catch {
        return () => undefined;
      }
    }

    const watchers = new Set<FSWatcher>();
    const packageWatchers = new Map<string, FSWatcher>();
    let debounceHandle: NodeJS.Timeout | null = null;

    const emitRefresh = () => {
      if (debounceHandle) {
        clearTimeout(debounceHandle);
      }

      debounceHandle = setTimeout(() => {
        callback({ type: "refresh" });
      }, 150);
    };

    const bindPackageWatchers = async (candidatePackagePaths?: string[]) => {
      for (const watcher of packageWatchers.values()) {
        watcher.close();
        watchers.delete(watcher);
      }
      packageWatchers.clear();

      const packagePaths =
        candidatePackagePaths && candidatePackagePaths.length > 0
          ? [...new Set(candidatePackagePaths.map((candidatePath) => path.resolve(candidatePath)))]
          : await (async () => {
              let entries;
              try {
                entries = await fs.readdir(resolvedDir, { withFileTypes: true });
              } catch {
                return [];
              }

              return entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => path.join(resolvedDir, entry.name));
            })();

      await Promise.all(
        packagePaths.map(async (packagePath) => {
          const resolvedPackagePath = path.resolve(packagePath);
          if (!isSameResolvedPath(path.dirname(resolvedPackagePath), resolvedDir)) {
            return;
          }

          if (!(await directoryContainsSkillPreview(resolvedPackagePath))) {
            return;
          }

          try {
            const watcher = watch(resolvedPackagePath, { persistent: false }, (_eventType, fileName) => {
              if (!fileName || fileName.toString().toLowerCase() === SKILL_PREVIEW_FILE) {
                emitRefresh();
              }
            });

            watchers.add(watcher);
            packageWatchers.set(resolvedPackagePath, watcher);
          } catch {
            // Ignore directories that disappear while the watcher is being attached.
          }
        }),
      );
    };

    try {
      const rootWatcher = watch(resolvedDir, { persistent: false }, () => {
        void bindPackageWatchers();
        emitRefresh();
      });
      watchers.add(rootWatcher);
    } catch {
      return () => undefined;
    }

    await bindPackageWatchers(knownPackagePaths);

    return () => {
      if (debounceHandle) {
        clearTimeout(debounceHandle);
      }

      for (const watcher of packageWatchers.values()) {
        watcher.close();
      }
      packageWatchers.clear();

      for (const watcher of watchers) {
        watcher.close();
      }
      watchers.clear();
    };
  }
}
