# Code Edit Video

一个用于制作代码模拟输入视频的 Web 工具。它可以逐字符模拟真实的代码编写过程，配合内置录屏功能，轻松创建代码教学/演示视频。

## 功能特性

### 代码模拟输入

- **自动模式** — 自动逐字符输入代码，支持可调节的输入速度
- **手动模式** — 按键触发输入，每次按键可配置输入 1 / 3 / 5 / 10 个字符
- **速度预设** — 慢速 (150ms)、中速 (80ms)、快速 (30ms)，也支持滑块精细调节 (5–250ms)
- **智能延迟** — 标点符号、换行等位置自动增加随机延迟，模拟真实输入节奏

### 行内指令

在代码注释中插入特殊标记，控制输入行为：

| 标记 | 说明 |
|------|------|
| `[pause]` | 输入到该行时自动暂停 |
| `[quick]` | 快速输入整行内容 |
| `[ignore]` | 跳过该行，不在输入过程中显示 |

### 框架模式 (Framework Mode)

先展示代码骨架结构，然后按照指定顺序在标记的插槽位置逐段输入代码片段：

```
[slot 插槽名:执行顺序:是否暂停]
```

适合展示在已有框架基础上逐步填充代码的教学场景。

### 屏幕录制

- 手动录制 — 随时开始/停止录制
- 自动录制 — 输入开始时自动启动录制，输入完成后自动停止
- 录制完成后可直接下载视频文件
- **桌面端增强** — 原生窗口截图 + H.264 编码，直接输出 MP4，无权限弹窗

### 实时预览

- 内嵌 iframe 实时预览 HTML 代码效果
- 预览窗口支持自由拖拽调节宽度和高度
- 安全校验：不完整的 `<script>` 或 `<style>` 标签不会中断预览

### 代码分割 (CodePen 集成)

- 将 HTML 文件自动拆分为 HTML / CSS / JavaScript 三部分
- 支持单独复制每个部分
- 可一键提交到 CodePen

### 编辑器

- 基于 [highlight.js](https://highlightjs.org/) 的语法高亮（HTML、CSS、JavaScript）
- 行号显示
- Tab 键支持
- 暗色主题 (Atom One Dark)

## 技术栈

- [Vue 3](https://vuejs.org/) — 组合式 API + `<script setup>`
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [highlight.js](https://highlightjs.org/) — 语法高亮
- [Tauri v2](https://v2.tauri.app/) — 桌面端框架（可选）
- [OpenH264](https://github.com/cisco/openh264) + [minimp4](https://github.com/nickleus27/minimp4.rs) — 桌面端 H.264 编码 & MP4 封装

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 16

### 安装与运行

```bash
# 克隆项目
git clone <repository-url>
cd code-edit-video

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问终端输出的本地地址（默认 `http://localhost:5173`）即可使用。

### 构建生产版本

```bash
npm run build
```

构建产物输出至 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

## 桌面客户端

桌面端基于 Tauri v2，提供原生窗口录屏能力：直接截取应用窗口 → H.264 编码 → 输出 MP4，无需浏览器权限弹窗。

### Web 录屏 vs 桌面端录屏

| | Web 版 | 桌面端 |
|---|---|---|
| 输出格式 | WebM | **MP4 (H.264)** |
| 权限弹窗 | 每次录制都需要 | **无需任何权限** |
| HTTPS 要求 | Display 模式必须 | **不需要** |
| 录制范围 | 整个屏幕/标签页 | **精确到应用窗口** |

### 环境要求

除 [Web 版要求](#环境要求) 外，还需要：

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- 系统 C 编译器（OpenH264 从源码编译需要）

**macOS：**

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Xcode Command Line Tools（提供 C 编译器）
xcode-select --install

# 可选：安装 nasm 加速 OpenH264 编码（快 2-3x）
brew install nasm
```

**Windows：**

```bash
# 安装 Rust (MSVC 版)
winget install Rustlang.Rust.MSVC

# 安装 C++ 构建工具
winget install Microsoft.VisualStudio.2022.BuildTools
# 安装时勾选「使用 C++ 的桌面开发」工作负载

# 可选：安装 nasm 加速 OpenH264 编码
winget install NASM.NASM
```

**Linux (Debian/Ubuntu)：**

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装系统依赖
sudo apt install build-essential libwebkit2gtk-4.1-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev

# 可选：安装 nasm
sudo apt install nasm
```

### 开发运行

```bash
# 安装依赖（首次）
npm install

# 启动桌面端开发模式（自动启动 Vite + Cargo）
npm run tauri:dev
```

首次运行会编译所有 Rust 依赖（~500 个 crate），大约需要 2-5 分钟，后续增量编译仅需几秒。

### 构建安装包

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`：

| 平台 | 产物 |
|------|------|
| macOS | `.dmg` / `.app` |
| Windows | `.msi` / `.exe` |
| Linux | `.deb` / `.AppImage` |

## 使用指南

1. **粘贴代码** — 点击「粘贴代码」按钮，将需要模拟输入的代码粘贴到弹窗中
2. **选择模式** — 选择自动或手动输入模式，调整输入速度
3. **开始输入** — 点击播放按钮开始模拟输入
4. **录制视频** — 开启「自动录屏」或手动点击录制按钮，输入过程将被录制
5. **下载视频** — 录制完成后点击下载，保存视频文件
6. **预览效果** — 展开预览面板查看 HTML 代码的实时渲染效果

## 项目结构

```
code-edit-video/
├── src/                           # 前端 (Vue 3 + TypeScript)
│   ├── components/
│   │   ├── CodeDisplay.vue        #   核心组件：编辑器 + 输入引擎 + 预览
│   │   └── CodeDisplay/           #   子组件（控制栏、弹窗等）
│   ├── composables/
│   │   ├── useRecording.ts        #   录屏门面：自动选择 Web/桌面方案
│   │   ├── useScreenRecording.ts  #   Web 录屏（getDisplayMedia / Canvas）
│   │   ├── useDesktopRecording.ts #   桌面录屏（Tauri IPC → Rust 后端）
│   │   ├── useTypingEngine.ts     #   打字模拟引擎
│   │   └── ...                    #   其他组合式函数
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── src-tauri/                     # 桌面端 Rust 后端 (Tauri v2)
│   ├── src/
│   │   ├── lib.rs                 #   Tauri Builder + IPC 命令定义
│   │   ├── recorder.rs            #   帧捕获循环（xcap 窗口截图）
│   │   ├── encoder.rs             #   H.264 编码 + MP4 封装
│   │   └── main.rs                #   桌面入口
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## License

MIT
