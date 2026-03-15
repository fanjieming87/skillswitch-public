import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";

const require = createRequire(import.meta.url);

const {
  FileService,
  resolveNearestExistingDirectory,
} = require("../dist-electron/services/FileService.js");
const { SyncService } = require("../dist-electron/services/SyncService.js");
const {
  DEFAULT_SLOT_PATHS,
  normalizeSlotFilePath,
} = require("../dist-electron/utils/slot-defaults.js");
const { DEFAULT_SOURCE_PATH } = require("../dist-electron/utils/path-resolver.js");

async function withTempDir(run) {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "skillswitch-acceptance-"));
  try {
    return await run(tempDir);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function expectTest(name, run) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function createSkillPackage(rootDir, skillName, files) {
  const skillDir = path.join(rootDir, skillName);
  await fsp.mkdir(skillDir, { recursive: true });

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(skillDir, relativePath);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, content, "utf8");
  }

  return skillDir;
}

async function waitForRefresh(service, sourceDir, mutate, timeoutMs = 4000) {
  let settled = false;

  return new Promise(async (resolve, reject) => {
    const finish = (handler, value) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutHandle);
      service.unwatchSourceDirectory();
      handler(value);
    };

    const timeoutHandle = setTimeout(() => {
      finish(reject, new Error(`Timed out waiting for a source refresh event in ${sourceDir}`));
    }, timeoutMs);

    try {
      await service.watchSourceDirectory(sourceDir, (event) => {
        finish(resolve, event);
      });
      await mutate();
    } catch (error) {
      finish(reject, error);
    }
  });
}

async function withMockedConfigService(userDataDir, run) {
  const originalLoad = Module._load;
  const configServicePath = require.resolve("../dist-electron/services/ConfigService.js");

  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === "electron") {
      return {
        app: {
          getPath(name) {
            assert.equal(name, "userData");
            return userDataDir;
          },
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[configServicePath];

  try {
    const configServiceModule = require(configServicePath);
    return await run(configServiceModule);
  } finally {
    delete require.cache[configServicePath];
    Module._load = originalLoad;
  }
}

async function runAcceptanceTests() {
  await expectTest("canonical slot defaults use the confirmed target directories", async () => {
    assert.equal(DEFAULT_SLOT_PATHS.codebuddy, "%USERPROFILE%\\.codebuddy\\skills");
    assert.equal(DEFAULT_SLOT_PATHS.gemini, "%USERPROFILE%\\.gemini\\antigravity\\skills");
    assert.equal(DEFAULT_SLOT_PATHS.qoder, "%USERPROFILE%\\.qoder\\skills");
    assert.equal(DEFAULT_SLOT_PATHS.copilot, "%USERPROFILE%\\.copilot\\skills");
    assert.equal(DEFAULT_SLOT_PATHS.claude, "%USERPROFILE%\\.claude\\skills");
  });

  await expectTest("legacy default paths normalize to the current canonical paths", async () => {
    assert.equal(
      normalizeSlotFilePath("gemini", "%USERPROFILE%\\.gemini\\custom_instructions"),
      DEFAULT_SLOT_PATHS.gemini,
    );
    assert.equal(
      normalizeSlotFilePath("qoder", "%USERPROFILE%\\.qoder\\skill"),
      DEFAULT_SLOT_PATHS.qoder,
    );
    assert.equal(
      normalizeSlotFilePath("claude", "%USERPROFILE%\\.claude\\system_prompts"),
      DEFAULT_SLOT_PATHS.claude,
    );
    assert.equal(
      normalizeSlotFilePath("codebuddy", "D:\\custom\\codebuddy"),
      "D:\\custom\\codebuddy",
    );
  });

  await expectTest("nearest existing browse directory falls back to the closest parent", async () => {
    await withTempDir(async (tempDir) => {
      const existingParent = path.join(tempDir, "claude");
      await fsp.mkdir(existingParent, { recursive: true });

      const nearest = await resolveNearestExistingDirectory(
        path.join(existingParent, "skills", "nested", "target"),
      );

      assert.equal(nearest, existingParent);
    });
  });

  await expectTest("directory picker wiring keeps the current slot path in the call chain", async () => {
    const settingsModalSource = await fsp.readFile(
      path.resolve("src/app/components/SettingsModal.tsx"),
      "utf8",
    );
    const appSource = await fsp.readFile(path.resolve("src/app/App.tsx"), "utf8");

    assert.match(settingsModalSource, /onBrowseSource\(localSource\.path\)/);
    assert.match(settingsModalSource, /onBrowseSlot\(slot\.id,\s*slot\.filePath\)/);
    assert.match(appSource, /selectDirectory\(currentPath\)/);
  });

  await expectTest("filtered preview routing reads the active slot preview instead of always using source content", async () => {
    const appSource = await fsp.readFile(path.resolve("src/app/App.tsx"), "utf8");

    assert.match(appSource, /function resolvePreviewTarget\(/);
    assert.match(appSource, /selectedSlot && slotPreview\?\.previewPath/);
    assert.match(appSource, /rootPath: selectedSlot\.filePath/);
    assert.match(appSource, /readSkillPreview\(previewTarget\.previewPath\)/);
    assert.match(appSource, /matchesActiveFilter/);
  });

  await expectTest("slot skill deletion removes only the selected slot directory and stays wired through the UI bridge", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const slotDir = path.join(tempDir, "qoder");
      const sourcePackage = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# source alpha\n",
      });
      const slotPackage = await createSkillPackage(slotDir, "alpha", {
        "skill.md": "# slot alpha\n",
        "nested/settings.json": "{\n  \"slot\": true\n}\n",
      });

      const service = new FileService();
      const deletedPath = await service.deleteSkillDirectory(slotDir, "alpha");

      assert.equal(deletedPath, slotPackage);
      assert.equal(fs.existsSync(slotPackage), false);
      assert.equal(fs.existsSync(sourcePackage), true);

      const appSource = await fsp.readFile(path.resolve("src/app/App.tsx"), "utf8");
      const editorSource = await fsp.readFile(
        path.resolve("src/app/components/CodeEditor.tsx"),
        "utf8",
      );
      const preloadSource = await fsp.readFile(path.resolve("electron/preload.ts"), "utf8");

      assert.match(appSource, /window\.confirm\(/);
      assert.match(appSource, /deleteSkillDirectory\(selectedDeleteSlot\.filePath,\s*selectedFile\.name\)/);
      assert.match(editorSource, /data-testid="preview-delete-button"/);
      assert.match(editorSource, /canDelete && onDelete/);
      assert.match(preloadSource, /ipcRenderer\.invoke\("file:deleteSkillDirectory", rootPath, skillName\)/);
    });
  });

  await expectTest("sidebar virtualization and preview caches stay enabled for large skill lists", async () => {
    const sidebarSource = await fsp.readFile(
      path.resolve("src/app/components/Sidebar.tsx"),
      "utf8",
    );
    const fileSystemSource = await fsp.readFile(
      path.resolve("src/app/hooks/useFileSystem.ts"),
      "utf8",
    );

    assert.match(sidebarSource, /useDeferredValue\(search\)/);
    assert.match(sidebarSource, /useRef<WeakMap<SkillPackage,\s*FileSearchMetadata>>/);
    assert.match(sidebarSource, /const VIRTUALIZATION_THRESHOLD = /);
    assert.match(sidebarSource, /paddingTop:\s*virtualPaddingTop/);
    assert.match(sidebarSource, /paddingBottom:\s*virtualPaddingBottom/);
    assert.match(fileSystemSource, /MAX_PREVIEW_CACHE_ENTRIES = 24/);
  });

  await expectTest("operation log viewer stays wired through the app shell and preload bridge", async () => {
    const appSource = await fsp.readFile(path.resolve("src/app/App.tsx"), "utf8");
    const preloadSource = await fsp.readFile(path.resolve("electron/preload.ts"), "utf8");
    const logHookSource = await fsp.readFile(path.resolve("src/app/hooks/useOperationLogs.ts"), "utf8");

    assert.match(appSource, /data-testid="open-log-modal-button"/);
    assert.match(appSource, /OperationLogModal/);
    assert.match(appSource, /useOperationLogs\(showOperationLogs\)/);
    assert.match(logHookSource, /if \(!enabled \|\| !window\.electronAPI\)/);
    assert.match(preloadSource, /logs:\s*\{/);
    assert.match(preloadSource, /ipcRenderer\.invoke\("logs:getEntries"\)/);
    assert.match(preloadSource, /ipcRenderer\.invoke\("logs:append", input\)/);
    assert.match(preloadSource, /ipcRenderer\.invoke\("logs:clear"\)/);
  });

  await expectTest("non-critical modals are lazy loaded and the main window waits before showing", async () => {
    const appSource = await fsp.readFile(path.resolve("src/app/App.tsx"), "utf8");
    const mainSource = await fsp.readFile(path.resolve("electron/main.ts"), "utf8");

    assert.match(appSource, /const OperationLogModal = lazy/);
    assert.match(appSource, /const SettingsModal = lazy/);
    assert.match(appSource, /const SyncConfirmModal = lazy/);
    assert.match(appSource, /<Suspense fallback={<DeferredModalFallback label="设置面板" \/>}>/);
    assert.match(mainSource, /show:\s*false/);
    assert.match(mainSource, /function attachDeferredWindowShow/);
    assert.match(mainSource, /window\.once\("ready-to-show", showWindow\)/);
  });

  await expectTest("source watcher setup reuses the first discovery result instead of forcing an immediate second scan", async () => {
    const appSource = await fsp.readFile(path.resolve("src/app/App.tsx"), "utf8");
    const preloadSource = await fsp.readFile(path.resolve("electron/preload.ts"), "utf8");
    const fileServiceSource = await fsp.readFile(path.resolve("electron/services/FileService.ts"), "utf8");

    assert.match(appSource, /watchSeed/);
    assert.match(appSource, /watchSeed\.packagePaths/);
    assert.match(preloadSource, /watchSourceDirectory: \(dirPath: string, knownPackagePaths\?: string\[\]\)/);
    assert.match(fileServiceSource, /knownPackagePaths: string\[\] = \[\]/);
    assert.match(fileServiceSource, /await bindPackageWatchers\(knownPackagePaths\)/);
  });

  await expectTest("diagnostic logging uses electron-log while keeping UI operation logs", async () => {
    const packageJsonSource = JSON.parse(await fsp.readFile(path.resolve("package.json"), "utf8"));
    const mainSource = await fsp.readFile(path.resolve("electron/main.ts"), "utf8");
    const operationLogServiceSource = await fsp.readFile(
      path.resolve("electron/services/OperationLogService.ts"),
      "utf8",
    );
    const loggerSource = await fsp.readFile(path.resolve("electron/utils/logger.ts"), "utf8");

    assert.equal(typeof packageJsonSource.dependencies["electron-log"], "string");
    assert.match(mainSource, /initializeDiagnosticLogger\(\)/);
    assert.match(mainSource, /new OperationLogService\(undefined,\s*mirrorOperationLogEntry\)/);
    assert.match(operationLogServiceSource, /Diagnostic log persistence is best-effort/);
    assert.match(loggerSource, /import log from "electron-log\/main"/);
  });

  await expectTest("skill package scanning only reads first-level directories with skill.md", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const qoderDir = path.join(tempDir, "qoder");
      await fsp.mkdir(sourceDir, { recursive: true });
      await fsp.mkdir(qoderDir, { recursive: true });

      await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\nname: alpha\n",
        "scripts/run.ps1": "Write-Host alpha\n",
      });
      await fsp.mkdir(path.join(sourceDir, "beta"), { recursive: true });
      await fsp.writeFile(path.join(sourceDir, "beta", "notes.txt"), "ignore me", "utf8");
      await createSkillPackage(sourceDir, "gamma", {
        "skill.md": "# gamma\nname: gamma\n",
      });
      await createSkillPackage(qoderDir, "gamma", {
        "skill.md": "# existing gamma\n",
      });

      const service = new FileService();
      const packages = await service.readSkillPackages(sourceDir, [
        {
          id: "source",
          name: "Source",
          color: "#000000",
          dotColor: "#000000",
          filePath: sourceDir,
          shortLabel: "SRC",
          isSource: true,
        },
        {
          id: "qoder",
          name: "Qoder",
          color: "#000000",
          dotColor: "#000000",
          filePath: qoderDir,
          shortLabel: "QD",
        },
      ]);

      assert.deepEqual(
        packages.map((item) => item.name),
        ["alpha", "gamma"],
      );
      assert.equal(packages[0].previewPath, path.join(sourceDir, "alpha", "skill.md"));
      assert.equal(packages[0].previewContent, "");
      assert.deepEqual(
        packages.find((item) => item.name === "gamma")?.slots,
        [
          {
            slotId: "qoder",
            active: true,
            previewPath: path.join(qoderDir, "gamma", "skill.md"),
          },
        ],
      );
      assert.deepEqual(
        packages.find((item) => item.name === "alpha")?.slots,
        [{ slotId: "qoder", active: false }],
      );

      const slotPreview = await service.readSkillPreview(path.join(qoderDir, "gamma", "skill.md"));
      assert.equal(slotPreview.previewPath, path.join(qoderDir, "gamma", "skill.md"));
      assert.match(slotPreview.previewContent, /existing gamma/);

      const sourcePreview = await service.readSkillPreview(path.join(sourceDir, "alpha", "skill.md"));
      assert.match(sourcePreview.previewContent, /name: alpha/);
    });
  });

  await expectTest("skill discovery ignores root files and deeper nested skill.md files", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      await fsp.mkdir(sourceDir, { recursive: true });

      await fsp.writeFile(path.join(sourceDir, "skill.md"), "# root should be ignored\n", "utf8");
      await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\n",
      });
      await fsp.mkdir(path.join(sourceDir, "container", "nested"), { recursive: true });
      await fsp.writeFile(
        path.join(sourceDir, "container", "nested", "skill.md"),
        "# nested should be ignored\n",
        "utf8",
      );

      const service = new FileService();
      const packages = await service.readSkillPackages(sourceDir, []);

      assert.deepEqual(
        packages.map((item) => item.name),
        ["alpha"],
      );
    });
  });

  await expectTest("source watcher refreshes when a skill.md preview changes", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const alphaDir = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\nversion: 1\n",
      });

      const service = new FileService();
      const event = await waitForRefresh(service, sourceDir, async () => {
        await fsp.writeFile(path.join(alphaDir, "skill.md"), "# alpha\nversion: 2\n", "utf8");
      });

      assert.equal(event.type, "refresh");
    });
  });

  await expectTest("source watcher refreshes when a valid first-level skill directory is added", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      await fsp.mkdir(sourceDir, { recursive: true });
      await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\n",
      });

      const service = new FileService();
      const event = await waitForRefresh(service, sourceDir, async () => {
        await createSkillPackage(sourceDir, "beta", {
          "skill.md": "# beta\n",
          "scripts/run.ps1": "Write-Host beta\n",
        });
      });

      assert.equal(event.type, "refresh");
    });
  });

  await expectTest("source watcher refreshes when a skill directory is removed", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const alphaDir = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\n",
      });

      const service = new FileService();
      const event = await waitForRefresh(service, sourceDir, async () => {
        await fsp.rm(alphaDir, { recursive: true, force: true });
      });

      assert.equal(event.type, "refresh");
    });
  });

  await expectTest("sync validation reports overwrite conflicts before copying", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");
      await fsp.mkdir(sourceDir, { recursive: true });
      await fsp.mkdir(targetDir, { recursive: true });

      const alphaPackage = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\n",
      });
      await createSkillPackage(targetDir, "alpha", {
        "skill.md": "# existing alpha\n",
      });

      const syncService = new SyncService({
        get() {
          return {
            slots: [
              {
                id: "qoder",
                name: "Qoder",
                color: "#000000",
                dotColor: "#000000",
                filePath: targetDir,
                shortLabel: "QD",
              },
            ],
          };
        },
      });

      const validation = await syncService.validateSync({
        sourceDir,
        packageIds: [alphaPackage],
        slotIds: ["qoder"],
      });

      assert.equal(validation.valid, true);
      assert.equal(validation.requiresOverwriteConfirmation, true);
      assert.equal(validation.conflicts.length, 1);
      assert.equal(validation.conflicts[0].packageName, "alpha");
      assert.equal(validation.conflicts[0].targetPath, path.join(targetDir, "alpha"));
    });
  });

  await expectTest("sync validation rejects nested and out-of-root package paths", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");
      const alphaDir = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\n",
        "nested/child.txt": "nested\n",
      });
      const outsideDir = await createSkillPackage(path.join(tempDir, "outside"), "omega", {
        "skill.md": "# omega\n",
      });

      const syncService = new SyncService({
        get() {
          return {
            slots: [
              {
                id: "qoder",
                name: "Qoder",
                color: "#000000",
                dotColor: "#000000",
                filePath: targetDir,
                shortLabel: "QD",
              },
            ],
          };
        },
      });

      const validation = await syncService.validateSync({
        sourceDir,
        packageIds: [path.join(alphaDir, "nested"), outsideDir],
        slotIds: ["qoder"],
      });

      assert.equal(validation.valid, false);
      assert.equal(validation.requiresOverwriteConfirmation, false);
      assert.match(validation.errors.join("\n"), /outside the source directory/);
    });
  });

  await expectTest("sync auto-creates missing slot roots and updates active slots after multi-skill multi-slot copy", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const qoderDir = path.join(tempDir, "qoder");
      const claudeDir = path.join(tempDir, "claude");
      await fsp.mkdir(sourceDir, { recursive: true });

      const alphaPackage = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\n",
        "scripts/run.ps1": "Write-Host alpha\n",
      });
      const gammaPackage = await createSkillPackage(sourceDir, "gamma", {
        "skill.md": "# gamma\n",
        "nested/config.json": "{\n  \"gamma\": true\n}\n",
      });

      const slots = [
        {
          id: "qoder",
          name: "Qoder",
          color: "#000000",
          dotColor: "#000000",
          filePath: qoderDir,
          shortLabel: "QD",
        },
        {
          id: "claude",
          name: "Claude",
          color: "#000000",
          dotColor: "#000000",
          filePath: claudeDir,
          shortLabel: "CL",
        },
      ];

      const syncService = new SyncService({
        get() {
          return { slots };
        },
      });

      const result = await syncService.syncToSlots({
        sourceDir,
        packageIds: [alphaPackage, gammaPackage],
        slotIds: ["qoder", "claude"],
      });

      assert.equal(result.total, 4);
      assert.equal(result.copied, 4);
      assert.equal(result.skipped, 0);
      assert.equal(result.failed, 0);
      assert.equal(fs.existsSync(path.join(qoderDir, "alpha", "skill.md")), true);
      assert.equal(fs.existsSync(path.join(qoderDir, "gamma", "nested", "config.json")), true);
      assert.equal(fs.existsSync(path.join(claudeDir, "alpha", "scripts", "run.ps1")), true);
      assert.equal(fs.existsSync(path.join(claudeDir, "gamma", "skill.md")), true);

      const fileService = new FileService();
      const packages = await fileService.readSkillPackages(sourceDir, [
        {
          id: "source",
          name: "Source",
          color: "#000000",
          dotColor: "#000000",
          filePath: sourceDir,
          shortLabel: "SRC",
          isSource: true,
        },
        ...slots,
      ]);

      for (const skillPackage of packages) {
        assert.deepEqual(skillPackage.slots, [
          {
            slotId: "qoder",
            active: true,
            previewPath: path.join(qoderDir, skillPackage.name, "skill.md"),
          },
          {
            slotId: "claude",
            active: true,
            previewPath: path.join(claudeDir, skillPackage.name, "skill.md"),
          },
        ]);
      }
    });
  });

  await expectTest("sync skips when the slot path is the same as the source path", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const alphaPackage = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\n",
      });

      const syncService = new SyncService({
        get() {
          return {
            slots: [
              {
                id: "codebuddy",
                name: "Codebuddy",
                color: "#000000",
                dotColor: "#000000",
                filePath: sourceDir,
                shortLabel: "CB",
              },
            ],
          };
        },
      });

      const validation = await syncService.validateSync({
        sourceDir,
        packageIds: [alphaPackage],
        slotIds: ["codebuddy"],
      });
      assert.equal(validation.valid, true);
      assert.equal(validation.conflicts.length, 0);

      const result = await syncService.syncToSlots({
        sourceDir,
        packageIds: [alphaPackage],
        slotIds: ["codebuddy"],
      });

      assert.equal(result.total, 1);
      assert.equal(result.copied, 0);
      assert.equal(result.skipped, 1);
      assert.equal(result.failed, 0);
      assert.equal(result.items[0].status, "skipped");
      assert.match(result.items[0].message ?? "", /same path/i);
    });
  });

  await expectTest("sync copies the whole directory and clears stale files and stale directories on overwrite", async () => {
    await withTempDir(async (tempDir) => {
      const sourceDir = path.join(tempDir, "source");
      const targetDir = path.join(tempDir, "target");
      await fsp.mkdir(sourceDir, { recursive: true });
      await fsp.mkdir(targetDir, { recursive: true });

      const alphaPackage = await createSkillPackage(sourceDir, "alpha", {
        "skill.md": "# alpha\nname: alpha\n",
        "scripts/run.ps1": "Write-Host alpha\n",
        "nested/deeper/config.json": "{\n  \"enabled\": true\n}\n",
      });

      const existingTarget = await createSkillPackage(targetDir, "alpha", {
        "skill.md": "# stale alpha\n",
        "old-only.txt": "stale\n",
        "old-dir/stale.txt": "stale nested\n",
      });
      assert.equal(fs.existsSync(path.join(existingTarget, "old-only.txt")), true);
      assert.equal(fs.existsSync(path.join(existingTarget, "old-dir", "stale.txt")), true);

      const syncService = new SyncService({
        get() {
          return {
            slots: [
              {
                id: "claude",
                name: "Claude",
                color: "#000000",
                dotColor: "#000000",
                filePath: targetDir,
                shortLabel: "CL",
              },
            ],
          };
        },
      });

      await assert.rejects(
        () =>
          syncService.syncToSlots({
            sourceDir,
            packageIds: [alphaPackage],
            slotIds: ["claude"],
          }),
        /Overwrite confirmation required/,
      );

      const result = await syncService.syncToSlots({
        sourceDir,
        packageIds: [alphaPackage],
        slotIds: ["claude"],
        allowOverwrite: true,
      });

      assert.equal(result.total, 1);
      assert.equal(result.copied, 1);
      assert.equal(result.failed, 0);

      const copiedRoot = path.join(targetDir, "alpha");
      assert.equal(fs.existsSync(path.join(copiedRoot, "skill.md")), true);
      assert.equal(fs.existsSync(path.join(copiedRoot, "scripts", "run.ps1")), true);
      assert.equal(
        fs.existsSync(path.join(copiedRoot, "nested", "deeper", "config.json")),
        true,
      );
      assert.equal(fs.existsSync(path.join(copiedRoot, "old-only.txt")), false);
      assert.equal(fs.existsSync(path.join(copiedRoot, "old-dir")), false);
    });
  });

  await expectTest("config service writes defaults on first read and persists updates", async () => {
    await withTempDir(async (tempDir) => {
      const userDataDir = path.join(tempDir, "userdata");

      await withMockedConfigService(userDataDir, async ({ ConfigService, createDefaultConfig }) => {
        const service = new ConfigService();
        const defaults = createDefaultConfig();
        const configPath = path.join(userDataDir, "config.json");

        const initial = service.get();
        assert.deepEqual(initial, defaults);
        assert.equal(fs.existsSync(configPath), true);

        service.set({
          slots: defaults.slots.map((slot) =>
            slot.id === "claude"
              ? { ...slot, filePath: "D:\\custom\\claude\\skills" }
              : slot,
          ),
          window: {
            x: 120,
            y: 240,
          },
        });

        const storedAfterSet = JSON.parse(await fsp.readFile(configPath, "utf8"));
        assert.equal(
          storedAfterSet.slots.find((slot) => slot.id === "claude")?.filePath,
          "D:\\custom\\claude\\skills",
        );
        assert.equal(storedAfterSet.window.x, 120);
        assert.equal(storedAfterSet.window.y, 240);

        const reset = service.reset();
        assert.deepEqual(reset, defaults);

        const storedAfterReset = JSON.parse(await fsp.readFile(configPath, "utf8"));
        assert.deepEqual(storedAfterReset, defaults);
      });
    });
  });

  await expectTest("config service normalizes legacy defaults and rewrites config.json on load", async () => {
    await withTempDir(async (tempDir) => {
      const userDataDir = path.join(tempDir, "userdata");
      const configPath = path.join(userDataDir, "config.json");
      await fsp.mkdir(userDataDir, { recursive: true });

      await withMockedConfigService(userDataDir, async ({ ConfigService, createDefaultSlots }) => {
        const legacySlots = createDefaultSlots().map((slot) => {
          if (slot.id === "gemini") {
            return { ...slot, filePath: "%USERPROFILE%\\.gemini\\custom_instructions" };
          }
          if (slot.id === "qoder") {
            return { ...slot, filePath: "%USERPROFILE%\\.qoder\\skill" };
          }
          if (slot.id === "claude") {
            return { ...slot, filePath: "%USERPROFILE%\\.claude\\system_prompts" };
          }
          return slot;
        });

        const legacyConfig = {
          version: "0.1.0",
          sourceConfig: {
            path: "%USERPROFILE%\\.codebuddy\\skills",
          },
          slots: legacySlots,
          preferences: {
            theme: "system",
            autoSync: false,
            syncInterval: 0,
            backupEnabled: true,
            maxBackups: 5,
          },
          window: {
            width: 1280,
            height: 820,
          },
        };

        await fsp.writeFile(configPath, JSON.stringify(legacyConfig, null, 2), "utf8");

        const service = new ConfigService();
        const normalized = service.get();

        assert.equal(normalized.sourceConfig.path, DEFAULT_SOURCE_PATH);
        assert.equal(
          normalized.slots.find((slot) => slot.id === "gemini")?.filePath,
          DEFAULT_SLOT_PATHS.gemini,
        );
        assert.equal(
          normalized.slots.find((slot) => slot.id === "qoder")?.filePath,
          DEFAULT_SLOT_PATHS.qoder,
        );
        assert.equal(
          normalized.slots.find((slot) => slot.id === "claude")?.filePath,
          DEFAULT_SLOT_PATHS.claude,
        );

        const rewritten = JSON.parse(await fsp.readFile(configPath, "utf8"));
        assert.equal(rewritten.sourceConfig.path, DEFAULT_SOURCE_PATH);
        assert.equal(
          rewritten.slots.find((slot) => slot.id === "gemini")?.filePath,
          DEFAULT_SLOT_PATHS.gemini,
        );
        assert.equal(
          rewritten.slots.find((slot) => slot.id === "qoder")?.filePath,
          DEFAULT_SLOT_PATHS.qoder,
        );
        assert.equal(
          rewritten.slots.find((slot) => slot.id === "claude")?.filePath,
          DEFAULT_SLOT_PATHS.claude,
        );
      });
    });
  });

  console.log("All acceptance checks passed.");
}

await runAcceptanceTests();
