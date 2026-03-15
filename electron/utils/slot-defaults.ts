import { resolveAppPath } from "./path-resolver";

export const LEGACY_SOURCE_PATH = "%USERPROFILE%\\.codebuddy\\skills";

export const DEFAULT_SLOT_PATHS = {
  codebuddy: "%USERPROFILE%\\.codebuddy\\skills",
  gemini: "%USERPROFILE%\\.gemini\\antigravity\\skills",
  qoder: "%USERPROFILE%\\.qoder\\skills",
  copilot: "%USERPROFILE%\\.copilot\\skills",
  claude: "%USERPROFILE%\\.claude\\skills",
} as const;

export const LEGACY_SLOT_PATHS: Partial<Record<keyof typeof DEFAULT_SLOT_PATHS, string[]>> = {
  gemini: [
    "%USERPROFILE%\\.gemini\\skills",
    "%USERPROFILE%\\.gemini\\custom_instructions",
  ],
  qoder: [
    "%USERPROFILE%\\.qoder",
    "%USERPROFILE%\\.qoder\\prompts",
    "%USERPROFILE%\\.qoder\\skill",
  ],
  claude: [
    "%USERPROFILE%\\.codex",
    "%USERPROFILE%\\.claude\\system_prompts",
  ],
};

export interface SlotPathLike {
  id: string;
  filePath: string;
}

export function normalizeSourcePath(sourcePath: string, defaultSourcePath: string): string {
  return sourcePath === LEGACY_SOURCE_PATH ? defaultSourcePath : sourcePath;
}

export function normalizeSlotFilePath(slotId: string, filePath: string): string {
  const normalizedSlotId = slotId as keyof typeof DEFAULT_SLOT_PATHS;
  const canonicalPath = DEFAULT_SLOT_PATHS[normalizedSlotId];
  const legacyPaths = LEGACY_SLOT_PATHS[normalizedSlotId] ?? [];

  if (!canonicalPath) {
    return filePath;
  }

  const normalizedFilePath = resolveAppPath(filePath);
  const isLegacyDefault = legacyPaths.some(
    (legacyPath) =>
      resolveAppPath(legacyPath) === normalizedFilePath || legacyPath === filePath,
  );

  return isLegacyDefault ? canonicalPath : filePath;
}

export function normalizeSlots<T extends SlotPathLike>(slots: T[]): T[] {
  return slots.map((slot) => ({
    ...slot,
    filePath: normalizeSlotFilePath(slot.id, slot.filePath),
  }));
}
