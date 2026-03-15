import os from "os";
import path from "path";

export const DEFAULT_SOURCE_PATH = "";

export function expandPathVariables(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    return "";
  }

  const withEnv = trimmed.replace(/%([^%]+)%/g, (_match, name: string) => {
    return process.env[name] ?? `%${name}%`;
  });

  if (withEnv.startsWith("~")) {
    return path.join(os.homedir(), withEnv.slice(1));
  }

  return withEnv;
}

export function resolveAppPath(inputPath: string): string {
  const expanded = expandPathVariables(inputPath);
  if (!expanded) {
    return "";
  }

  return path.normalize(path.resolve(expanded));
}

export function pathsEqual(left: string, right: string): boolean {
  return resolveAppPath(left).toLowerCase() === resolveAppPath(right).toLowerCase();
}
