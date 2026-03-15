import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const isWindows = process.platform === "win32";
const builderBinary = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  isWindows ? "electron-builder.cmd" : "electron-builder",
);

const forwardedArgs = process.argv.slice(2);
const env = { ...process.env };
const projectElectronBuilderBinariesMirror =
  "https://npmmirror.com/mirrors/electron-builder-binaries/";

// Packaging should use the project-level electronDownload config. Remove any
// externally injected mirror/custom version overrides so they cannot take
// precedence over electron-builder.yml.
const electronOverrideEnvKeys = [
  "ELECTRON_MIRROR",
  "ELECTRON_NIGHTLY_MIRROR",
  "ELECTRON_CUSTOM_DIR",
  "ELECTRON_CUSTOM_FILENAME",
  "ELECTRON_CUSTOM_VERSION",
  "npm_config_electron_mirror",
  "NPM_CONFIG_ELECTRON_MIRROR",
  "npm_config_electron_nightlymirror",
  "npm_config_electron_nightly_mirror",
  "NPM_CONFIG_ELECTRON_NIGHTLY_MIRROR",
  "npm_config_electron_customdir",
  "npm_config_electron_custom_dir",
  "NPM_CONFIG_ELECTRON_CUSTOM_DIR",
  "npm_config_electron_customfilename",
  "npm_config_electron_custom_filename",
  "NPM_CONFIG_ELECTRON_CUSTOM_FILENAME",
  "npm_config_electron_customversion",
  "npm_config_electron_custom_version",
  "NPM_CONFIG_ELECTRON_CUSTOM_VERSION",
];

for (const key of electronOverrideEnvKeys) {
  delete env[key];
}

// electron-builder downloads winCodeSign / NSIS and other helper artifacts
// through a separate mirror pipeline. Pin that mirror here so packaging does
// not depend on npm exposing unknown project config keys from .npmrc.
const builderBinaryOverrideEnvKeys = [
  "ELECTRON_BUILDER_BINARIES_DOWNLOAD_OVERRIDE_URL",
  "ELECTRON_BUILDER_BINARIES_MIRROR",
  "ELECTRON_BUILDER_BINARIES_CUSTOM_DIR",
  "npm_config_electron_builder_binaries_mirror",
  "NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR",
  "npm_config_electron_builder_binaries_custom_dir",
  "NPM_CONFIG_ELECTRON_BUILDER_BINARIES_CUSTOM_DIR",
];

for (const key of builderBinaryOverrideEnvKeys) {
  delete env[key];
}

env.NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR =
  projectElectronBuilderBinariesMirror;

const child = isWindows
  ? spawn("cmd.exe", ["/d", "/s", "/c", builderBinary, ...forwardedArgs], {
      cwd: projectRoot,
      env,
      stdio: "inherit",
      shell: false,
    })
  : spawn(builderBinary, forwardedArgs, {
      cwd: projectRoot,
      env,
      stdio: "inherit",
      shell: false,
    });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
