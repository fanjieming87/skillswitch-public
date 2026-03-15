# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository

## 项目概述

SkillSwitch 是一个 Electron 桌面应用，用于在多个 AI 平台（Codebuddy、Gemini、Qoder、Copilot、Claude）之间管理和同步技能目录。应用管理包含 `skill.md` 文件的一级技能目录，并允许将它们从源目录同步到多个目标平台插槽。

## 开发命令

- `npm run dev`: 启动完整开发环境（渲染进程、主进程和 Electron 窗口并行运行）
- `npm run dev:renderer`: 仅启动 React UI 的 Vite 开发服务器（端口 5173）
- `npm run dev:main`: 监听并编译 Electron TypeScript 主进程代码
- `npm run dev:electron`: 在开发模式下启动 Electron 应用
- `npm run build`: 构建生产版本（渲染进程和 Electron 主进程）
- `npm run build:renderer`: 构建 React UI 到 `dist/` 目录
- `npm run build:electron`: 清理并编译 Electron 主进程到 `dist-electron/`
- `npm run test`: 运行所有测试（单元测试、集成测试和验收测试）
- `npm run test:unit`: 运行单元测试（配置、文件和同步服务）
- `npm run test:unit:coverage`: 运行单元测试并生成覆盖率报告（要求 80% 覆盖率）
- `npm run test:integration`: 运行集成测试（IPC 处理器）
- `npm run test:acceptance`: 运行验收测试，验证核心服务逻辑（文件发现、同步、配置、监听器）
- `npm run preview`: 本地预览生产构建
- `npm run electron:dist`: 通过 electron-builder 构建 Windows 安装程序（NSIS）

## 架构

### 进程架构

应用遵循 Electron 的多进程架构：

1. **主进程** (`electron/main.ts`)：管理应用生命周期、窗口管理和原生文件操作
2. **预加载脚本** (`electron/preload.ts`)：通过 contextBridge 暴露安全的 IPC API
3. **渲染进程** (`src/`)：消费 Electron API 的 React UI

### 核心设计原则

**UI 代码唯一来源**：`figma/` 目录包含从 Figma 导出的 React 原型代码。实现功能时，先阅读 `figma/src/app/components/` 中对应的组件以了解预期的 UI/UX。仅用真实的 Electron API 替换 mock 数据 - 绝不修改原型的样式、布局或动画。

### 文件系统数据模型

应用操作的是**技能目录**，而非单个 `.skill` 文件：

- 源目录结构：`sourceDir/<skill-name>/skill.md`
- 仅扫描一级子目录中的技能
- 目录必须包含 `skill.md` 才能被识别为有效技能
- 侧边栏显示技能目录名（如 `skill-name1`）
- 中间面板显示 `skill.md` 内容的只读预览
- 活跃插槽通过检查插槽目录是否包含带 `skill.md` 的技能目录来确定

### 核心服务

**FileService** (`electron/services/FileService.ts`)：

- 扫描源目录查找技能包
- 使用 chokidar 监控目录变化（300ms 防抖）
- 为每个技能计算活跃插槽状态
- 提供原生目录选择器对话框

**SyncService** (`electron/services/SyncService.ts`)：

- 验证同步操作（冲突检测、路径验证）
- 递归复制目录到目标插槽
- 当源目录等于目标目录时跳过自同步
- 自动创建不存在的目标目录

**ConfigService** (`electron/services/ConfigService.ts`)：

- 将配置持久化到 `%APPDATA%/skillswitch/config.json`
- 为 Codebuddy、Gemini、Qoder、Copilot、Claude 提供默认插槽路径
- 自动迁移旧版默认路径到当前标准
- 存储窗口边界以保持状态

### IPC 通信

所有通信通过 `src/types/electron.d.ts` 中定义的类型化通道进行：

- `file:*`：文件系统操作（readSkillPackages、watchSourceDirectory、selectDirectory）
- `sync:*`：同步操作（validateSync、syncToSlots）
- `config:*`：配置管理（get、set、reset）
- `window:*`：窗口控制（minimize、maximize、close、isMaximized）
- 事件通道：`file:sourceDirectoryChanged`、`window:maximized`

### React Hooks 架构

渲染进程使用自定义 hooks 封装 Electron API 调用：

- `useFileSystem`：管理技能包加载、目录监听和目录选择
- `useSync`：封装同步验证和执行
- `useConfig`：处理配置持久化
- `useWindow`：提供窗口控制操作

### 应用主流程

1. 应用通过 `useConfig` hook 加载配置
2. 为源目录初始化文件系统监听器
3. 加载技能包并在侧边栏显示
4. 用户选择技能在中间面板预览 `skill.md`
5. 用户打开设置模态框配置插槽路径
6. 用户打开同步模态框选择技能和目标插槽
7. 同步验证检查冲突
8. 用户确认同步，目录被复制
9. 活跃插槽状态自动更新

### 安全模型

- `contextIsolation: enabled` - 渲染进程无法直接访问 Node API
- `nodeIntegration: false` - 渲染进程中无直接 Node 访问
- 所有原生操作通过预加载脚本的 contextBridge 暴露
- 路径验证防止目录遍历攻击
- 文件操作使用 Node.js `fs.promises` 确保异步安全

### 构建流程

1. **开发**：TypeScript 监听编译到 `dist-electron/`；Vite 从内存提供 React 服务
2. **生产**：Vite 构建到 `dist/`；TypeScript 编译 Electron 代码到 `dist-electron/`
3. **打包**：electron-builder 通过 `electron:dist` 命令创建 NSIS 安装程序

### 测试策略

- **单元测试**：`test/unit/` 目录中的 Node.js 内置测试框架测试，覆盖 ConfigService、FileService、SyncService，要求 80% 覆盖率
- **集成测试**：`test/integration/` 测试 IPC 处理器和完整通信流程
- **验收测试**：`scripts/run-acceptance-tests.mjs` 验证文件发现、同步逻辑、配置持久化和监听器行为，无需 Electron UI
- **UI 测试**：尚未实现 - 计划使用 Playwright/Electron E2E 测试进行完整工作流验证
- 提交核心服务更改前运行测试

### 默认插槽路径

插槽路径定义在 `electron/utils/slot-defaults.ts` 中并自动归一化：

- Codebuddy：`~/AppData/Roaming/codebuddy/skills`
- Gemini：`~/AppData/Roaming/google-gemini/skills`
- Qoder：`~/AppData/Roaming/qoder/skills`
- Copilot：`~/AppData/Roaming/copilot/skills`
- Claude：`~/AppData/Roaming/claude/skills`

`~` 通过 `os.homedir()` 展开为用户主目录。旧版路径在加载配置时自动迁移。

### 重要实现细节

- **目录选择**：SettingsModal 中的"浏览目录"按钮接收当前插槽路径作为 `defaultPath`，确保原生对话框在预期位置打开。这修复了之前对话框在上次浏览位置打开的问题
- **路径解析**：所有路径使用 `path.join()` 确保跨平台兼容。`resolveAppPath` 工具处理 `~` 展开
- **监听器清理**：FileService 维护单个 FSWatcher 实例；窗口关闭或源路径更改时必须调用 unwatching
- **源插槽**：源目录被视为伪插槽，具有 `isSource: true` 和 `id: "source"`，用于一致的插槽过滤 UI
- **同步冲突**：当目标插槽已包含带 `skill.md` 的技能目录时，应用显示确认对话框列出所有冲突后再继续
- **活跃插槽显示**：每个技能包有一个 `slots` 数组显示哪些插槽激活了该技能。这通过检查插槽目录是否包含带 `skill.md` 的技能目录来计算

### 关键文件

- `src/app/App.tsx` - 主应用组件和状态编排
- `src/app/components/` - 所有 UI 组件（参考自 `figma/` 原型）
- `src/app/hooks/` - Electron API 集成的 React hooks
- `electron/main.ts` - 主进程入口和窗口管理
- `electron/preload.ts` - IPC API 暴露
- `electron/services/` - 核心业务逻辑
- `electron/ipc/` - IPC 通道处理器
- `src/types/electron.d.ts` - ElectronAPI 的 TypeScript 定义
- `test/unit/` - 单元测试（config、file、sync 服务）
- `test/integration/` - 集成测试（IPC 处理器）
- `test/helpers/` - 测试辅助工具
- `scripts/run-acceptance-tests.mjs` - 验收测试套件

### 开发注意事项

- 添加新 IPC 通道时，同时更新 `electron/preload.ts` 和 `src/types/electron.d.ts`
- 文件监听器使用 300ms 防抖，避免快速变化时过度重新加载
- 应用无原生标题栏（frame: false）- 自定义窗口控制在 React UI 中
- 当 `window.electronAPI` 未定义时（如在浏览器中），`src/app/components/mockData.ts` 中的 `SKILL_PACKAGES` mock 数据被使用
- 窗口状态（边界、最大化状态）通过 ConfigService 跨应用重启持久化
- DevTools 不会在开发模式下自动打开，以避免 Electron 版本兼容性警告。需要调试时按 `Ctrl+Shift+I` 手动打开
