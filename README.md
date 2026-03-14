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

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18

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
├── src/
│   ├── components/
│   │   └── CodeDisplay.vue    # 核心组件：编辑器 + 输入引擎 + 预览
│   ├── assets/                # 静态资源
│   ├── App.vue                # 根组件
│   ├── main.ts                # 应用入口
│   └── style.css              # 全局样式
├── public/                    # 公共静态资源
├── index.html                 # HTML 模板
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## License

MIT
