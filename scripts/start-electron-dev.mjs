import { spawn } from "node:child_process";
import { statSync, watchFile, unwatchFile } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forwardedElectronArgs = process.argv.slice(2);
const electronEntryPaths = [
  path.join(rootDir, "dist-electron", "main.js"),
  path.join(rootDir, "dist-electron", "preload.js"),
];
const waitTimeoutMs = 60_000;
const waitIntervalMs = 250;
const restartDebounceMs = 300;
const buildStableIntervalMs = 400;
const vitePortStart = 5173;
const vitePortScanCount = 20;
const devServerMarkers = ["<title>SkillSwitch</title>", '/src/main.tsx'];

const electronBinary =
  process.platform === "win32"
    ? path.join(rootDir, "node_modules", ".bin", "electron.cmd")
    : path.join(rootDir, "node_modules", ".bin", "electron");

const electronCommand =
  process.platform === "win32" ? "cmd.exe" : electronBinary;

const electronArgs =
  process.platform === "win32"
    ? ["/c", electronBinary, ...forwardedElectronArgs, "."]
    : [...forwardedElectronArgs, "."];

let electronProcess = null;
let shuttingDown = false;
let restartRequested = false;
let restartReason = "";
let restartTimer = null;
let devServerUrl = "";
let launchPromise = null;
const watchedMtimes = new Map();

function log(message) {
  console.log(`[dev:electron] ${message}`);
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(check, label) {
  const start = Date.now();

  while (Date.now() - start < waitTimeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, waitIntervalMs));
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function resolveDevServerUrl() {
  return waitFor(async () => {
    for (let offset = 0; offset < vitePortScanCount; offset += 1) {
      const port = vitePortStart + offset;
      const url = `http://127.0.0.1:${port}`;

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(waitIntervalMs),
        });

        if (!response.ok) {
          continue;
        }

        const html = await response.text();
        if (devServerMarkers.every((marker) => html.includes(marker))) {
          return url;
        }
      } catch {
        continue;
      }
    }

    return null;
  }, "the Vite dev server");
}

async function waitForElectronBuild() {
  await waitFor(async () => {
    const results = await Promise.all(electronEntryPaths.map((entryPath) => pathExists(entryPath)));
    return results.every(Boolean);
  }, "the Electron build output");
}

function readWatchedMtimes() {
  return electronEntryPaths.map((entryPath) => {
    try {
      return statSync(entryPath).mtimeMs;
    } catch {
      return 0;
    }
  });
}

async function waitForStableElectronBuild() {
  await waitForElectronBuild();

  let previousMtimes = readWatchedMtimes();

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, buildStableIntervalMs));
    const currentMtimes = readWatchedMtimes();

    if (currentMtimes.every((mtime, index) => mtime > 0 && mtime === previousMtimes[index])) {
      return currentMtimes;
    }

    previousMtimes = currentMtimes;
  }
}

function terminateElectronProcess() {
  if (!electronProcess || electronProcess.killed) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(electronProcess.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    killer.on("error", () => {
      electronProcess?.kill();
    });
    return;
  }

  electronProcess.kill("SIGTERM");
}

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function scheduleRestart(reason) {
  if (shuttingDown) {
    return;
  }

  restartReason = reason;
  clearRestartTimer();

  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartRequested = true;

    if (!electronProcess) {
      if (!launchPromise) {
        void launchElectron();
      }
      return;
    }

    log(`Restarting Electron (${restartReason})...`);
    terminateElectronProcess();
  }, restartDebounceMs);
}

function cleanupWatchers() {
  for (const watchedPath of electronEntryPaths) {
    unwatchFile(watchedPath);
  }
}

function registerWatchers() {
  for (const watchedPath of electronEntryPaths) {
    try {
      watchedMtimes.set(watchedPath, statSync(watchedPath).mtimeMs);
    } catch {
      watchedMtimes.set(watchedPath, 0);
    }

    watchFile(watchedPath, { interval: 250 }, (current, previous) => {
      const previousMtime = watchedMtimes.get(watchedPath) ?? previous.mtimeMs;
      if (current.mtimeMs === previousMtime) {
        return;
      }

      watchedMtimes.set(watchedPath, current.mtimeMs);

      scheduleRestart(`${path.basename(watchedPath)} rebuilt`);
    });
  }
}

async function launchElectron(skipBuildWait = false) {
  if (shuttingDown || electronProcess) {
    return;
  }

  if (launchPromise) {
    return launchPromise;
  }

  launchPromise = (async () => {
    if (!skipBuildWait) {
      await waitForStableElectronBuild();
    }

    devServerUrl = await resolveDevServerUrl();

    log(`Launching Electron with ${devServerUrl}`);

    const child = spawn(electronCommand, electronArgs, {
      cwd: rootDir,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: devServerUrl,
      },
      stdio: "inherit",
      windowsHide: true,
    });

    electronProcess = child;

    child.on("error", (error) => {
      console.error(error);
      process.exit(1);
    });

    child.on("exit", () => {
      electronProcess = null;

      if (shuttingDown) {
        process.exit(0);
        return;
      }

      if (restartRequested) {
        const reason = restartReason;
        restartRequested = false;
        restartReason = "";
        log(`Electron stopped, starting again (${reason})...`);
        void launchElectron();
        return;
      }

      process.exit(0);
    });
  })();

  try {
    await launchPromise;
  } finally {
    launchPromise = null;
  }
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  restartRequested = false;
  restartReason = "";
  clearRestartTimer();
  cleanupWatchers();

  if (!electronProcess) {
    process.exit(0);
    return;
  }

  terminateElectronProcess();
}

async function main() {
  await waitForStableElectronBuild();
  await resolveDevServerUrl();
  registerWatchers();
  await launchElectron(true);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", cleanupWatchers);

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
