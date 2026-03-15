import { useRef, useState } from "react";
import { SKILL_PACKAGES } from "../components/mockData";
import type { SkillPackage } from "../components/types";

const MAX_PREVIEW_CACHE_ENTRIES = 24;

interface SkillPreviewDocument {
  previewPath: string;
  previewContent: string;
  lastModified: string;
}

function joinRootAndSkillName(rootPath: string, skillName: string): string {
  const separator = /[\\/]$/.test(rootPath) ? "" : "\\";
  return `${rootPath}${separator}${skillName}`;
}

export function useFileSystem() {
  const [files, setFiles] = useState<SkillPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewCacheRef = useRef<Map<string, SkillPreviewDocument>>(new Map());

  const clearPreviewCache = (): void => {
    previewCacheRef.current.clear();
  };

  const getCachedPreview = (previewPath: string): SkillPreviewDocument | null => {
    const cached = previewCacheRef.current.get(previewPath);
    if (!cached) {
      return null;
    }

    previewCacheRef.current.delete(previewPath);
    previewCacheRef.current.set(previewPath, cached);
    return cached;
  };

  const cachePreview = (previewDocument: SkillPreviewDocument): SkillPreviewDocument => {
    previewCacheRef.current.delete(previewDocument.previewPath);
    previewCacheRef.current.set(previewDocument.previewPath, previewDocument);

    while (previewCacheRef.current.size > MAX_PREVIEW_CACHE_ENTRIES) {
      const oldestKey = previewCacheRef.current.keys().next().value;
      if (!oldestKey) {
        break;
      }

      previewCacheRef.current.delete(oldestKey);
    }

    return previewDocument;
  };

  const loadFiles = async (sourcePath: string): Promise<SkillPackage[]> => {
    setLoading(true);
    try {
      clearPreviewCache();

      if (!window.electronAPI) {
        setFiles(SKILL_PACKAGES);
        setError(null);
        return SKILL_PACKAGES;
      }

      const next = await window.electronAPI.file.readSkillPackages(sourcePath);
      setFiles(next);
      setError(null);
      return next;
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load skill packages.";
      setFiles([]);
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const watchSourceDirectory = async (
    sourcePath: string,
    onChange: () => void,
    knownPackagePaths: string[] = [],
  ): Promise<() => void> => {
    if (!window.electronAPI || !sourcePath.trim()) {
      return () => undefined;
    }

    const listener = () => {
      onChange();
    };

    window.electronAPI.on("file:sourceDirectoryChanged", listener);

    try {
      await window.electronAPI.file.watchSourceDirectory(sourcePath, knownPackagePaths);
    } catch (watchError) {
      const message =
        watchError instanceof Error ? watchError.message : "Failed to watch source directory.";
      window.electronAPI.off("file:sourceDirectoryChanged", listener);
      setError(message);
      throw watchError;
    }

    return () => {
      window.electronAPI?.off("file:sourceDirectoryChanged", listener);
      void window.electronAPI?.file.unwatchSourceDirectory();
    };
  };

  const selectDirectory = async (defaultPath?: string): Promise<string | null> => {
    if (!window.electronAPI) {
      return null;
    }

    return window.electronAPI.file.selectDirectory(defaultPath);
  };

  const readSkillPreview = async (
    previewPath: string,
  ): Promise<SkillPreviewDocument> => {
    const cached = getCachedPreview(previewPath);
    if (cached) {
      return cached;
    }

    if (!window.electronAPI) {
      const matchingMockFile = SKILL_PACKAGES.find((item) => item.previewPath === previewPath);
      return cachePreview({
        previewPath,
        previewContent: matchingMockFile?.previewContent ?? "",
        lastModified: matchingMockFile?.lastModified ?? "just now",
      });
    }

    const previewDocument = await window.electronAPI.file.readSkillPreview(previewPath);
    return cachePreview(previewDocument);
  };

  const deleteSkillDirectory = async (rootPath: string, skillName: string): Promise<string> => {
    clearPreviewCache();

    if (!window.electronAPI) {
      return joinRootAndSkillName(rootPath, skillName);
    }

    return window.electronAPI.file.deleteSkillDirectory(rootPath, skillName);
  };

  return {
    files,
    loading,
    error,
    loadFiles,
    watchSourceDirectory,
    selectDirectory,
    readSkillPreview,
    deleteSkillDirectory,
    peekSkillPreview: getCachedPreview,
    clearPreviewCache,
    setFiles,
  };
}
