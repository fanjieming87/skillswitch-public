import fs from "fs";
import path from "path";
import { app, nativeTheme } from "electron";

export type TrayIconTheme = "light" | "dark";
export type TrayIconSize = 16 | 32;

const REQUIRED_ICON_FILES = [
  "icon.png",
  "icon.ico",
  "tray/tray-light-16.png",
  "tray/tray-light-32.png",
  "tray/tray-dark-16.png",
  "tray/tray-dark-32.png",
] as const;

function getResourcesRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }

  return path.join(__dirname, "..", "..", "resources");
}

function resolveExistingResource(relativePath: string): string | undefined {
  const candidateRoots = app.isPackaged
    ? [getResourcesRoot(), path.join(getResourcesRoot(), "resources")]
    : [getResourcesRoot()];

  for (const rootPath of candidateRoots) {
    const absolutePath = path.join(rootPath, relativePath);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return undefined;
}

export function getRequiredIconFiles(): readonly string[] {
  return REQUIRED_ICON_FILES;
}

export function getAppPngIconPath(): string | undefined {
  return resolveExistingResource("icon.png");
}

export function getWindowsAppIconPath(): string | undefined {
  return resolveExistingResource("icon.ico");
}

export function getWindowIconPath(): string | undefined {
  if (process.platform === "win32") {
    return getWindowsAppIconPath() ?? getAppPngIconPath();
  }

  return getAppPngIconPath();
}

export function getTrayIconPath(
  theme: TrayIconTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light",
  size: TrayIconSize = 16,
): string | undefined {
  const preferred = resolveExistingResource(path.join("tray", `tray-${theme}-${size}.png`));
  if (preferred) {
    return preferred;
  }

  const fallbackSize: TrayIconSize = size === 16 ? 32 : 16;
  return (
    resolveExistingResource(path.join("tray", `tray-${theme}-${fallbackSize}.png`)) ??
    getWindowIconPath()
  );
}
