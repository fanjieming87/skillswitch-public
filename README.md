# SkillSwitch

SkillSwitch 是一个基于 Electron + React + Vite 的 Windows 桌面工具，用来浏览源技能目录中的 `skill.md`，并将完整技能目录同步到多个本地目标槽位。

## 主要能力

- 浏览源目录下第一层技能目录
- 只读预览每个技能目录中的 `skill.md`
- 同步整个技能目录到多个本地槽位
- 支持覆盖保护、同步回滚、操作日志
- 支持系统托盘和关闭最小化到托盘

## 环境要求

- Windows 10 / 11
- Node.js 20+
- npm 10+

在 PowerShell 中建议使用 `npm.cmd`，避免部分环境下 `npm` 解析异常。

## 开发运行

安装依赖：

```powershell
npm.cmd install
```

启动开发环境：

```powershell
npm.cmd run dev
```

常用命令：

```powershell
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:acceptance
npm.cmd run test:e2e
npm.cmd test
```

说明：

- `build`：编译 renderer 和 Electron 主进程
- `test:unit`：运行服务层单元测试
- `test:integration`：运行 IPC 集成测试
- `test:acceptance`：运行验收脚本
- `test:e2e`：运行 Electron 端到端测试
- `test`：执行完整回归

## 生成 EXE

默认分发命令：

```powershell
npm.cmd run electron:dist
```

当前默认产物为绿色免安装单文件 EXE，文件名格式：

```text
SkillSwitch-<version>-win-x64-portable.exe
```

实际输出目录：

```text
release/
```

当前也保留了可选安装器命令：

```powershell
npm.cmd run electron:dist:nsis
```

## 打包实现说明

默认绿色版打包采用两段式：

1. 先生成 `release/win-unpacked`
2. 再基于 `win-unpacked` 二次封装为 `portable.exe`

这样更适合当前项目在 Windows 下稳定产出单文件绿色版。

## 关于 Electron 下载源问题

这个项目的打包脚本没有直接裸调 `electron-builder`，而是通过 [run-electron-builder.mjs](./scripts/run-electron-builder.mjs) 包一层执行。

原因是有些本机环境会预先注入全局变量，例如：

- `ELECTRON_MIRROR`
- `ELECTRON_CUSTOM_DIR`

这类环境变量的优先级高于项目自身的下载配置，可能把仓库原本约定好的打包下载源覆盖掉。

当前仓库的修复方案是：

- 在 `electron-builder.yml` 中显式配置 `electronDownload`
- 默认使用 `https://npmmirror.com/mirrors/electron/` 作为 Electron 下载源
- 通过 `customDir: "{{ version }}"` 让打包时按 Electron 版本号拼接镜像目录
- 在 `run-electron-builder.mjs` 中清理外部注入的 `ELECTRON_*` 和 `npm_config_electron_*` 覆盖项，确保项目配置生效
- 在 `run-electron-builder.mjs` 中显式固定 `electron-builder-binaries` 镜像，覆盖 `winCodeSign` / `nsis` 等辅助工具下载

这样做的目的是保留项目自己的镜像策略，同时避免“本机环境污染”直接把打包流程带偏。

仓库根目录的 `.npmrc` 现在主要用于 `npm install` 阶段的 Electron 下载加速；打包阶段不再依赖它来决定最终镜像源。这样即使后续 npm 不再向脚本透传这些未知项目配置，仓库里的打包行为也不会变。

## 当前分发建议

- 对外分发优先使用 `release/SkillSwitch-<version>-win-x64-portable.exe`
- 文件名已明确标注 `win-x64`，表示当前仅支持 Windows x64
- 用户升级时可直接下载新版本 EXE 替换旧文件

## 已知事项

- 当前未做代码签名，Windows 可能提示“未知发布者”
- 某些机器打包时如果遇到 `winCodeSign` 的符号链接权限问题，建议开启 Windows 开发者模式或使用管理员终端重试
