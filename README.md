# Code Edit Video

中文文档 | [English](./README.en.md)

Code Edit Video 是一个用于生成“代码手打演示视频”的工具：支持逐字符模拟输入、录屏导出、以及 HTML 预览。

## 亮点

- 自动/手动两种打字模式
- 行内标记指令（`[pause]` / `[quick]` / `[save]` / `[ignore]`）
- 插槽框架模式（先展示骨架，再按顺序填充片段）
- Web 与桌面端双录屏方案
- 顶部实时“已保存/未保存”状态
- 预览改为“主动保存时刷新”（`Ctrl/Cmd + S`）

## 快速开始（Web）

### 环境要求

- Node.js >= 16

### 安装与运行

```bash
npm install
npm run dev
```

默认访问 `http://localhost:5173`。

### 构建

```bash
npm run build
npm run preview
```

## 桌面端（Tauri）

桌面端提供原生窗口录制链路：窗口捕获 -> H.264 编码 -> MP4 输出。

### 额外依赖

- Rust stable
- 系统 C 编译器（OpenH264 源码编译需要）

### 开发运行

```bash
npm run tauri:dev
```

### 构建安装包

```bash
npm run tauri:build
```

产物目录：`src-tauri/target/release/bundle/`

## 打字模式与指令

### 打字模式

- 自动模式：按速度参数连续输入
- 手动模式：每次按键输入固定字符数

### 行内标记指令

可在注释行尾写入指令（支持 `<!-- -->`、`/* */`、`//`、`#` 风格）：

- `[pause]`：输入到该行时暂停
- `[quick]`：该行瞬间输入
- `[save]`：该行完成后主动保存（触发预览刷新）
- `[ignore]`：该行跳过不输入

示例：

```html
<div class="card">Hello</div> <!--[save]-->
```

```css
.title { color: #333; } /*[quick]*/
```

```js
console.log('step 1') // [pause]
```

## 插槽框架模式

插槽模式用于“先显示结构，再填充内容”。

- `[slot] ... [/slot]`：定义一个片段
- `[slot:2]`：指定执行顺序（数字越小越先）
- `[slot:nopause]`：该片段完成后不暂停
- `[slot:1:nopause]`：组合参数

在插槽模式下，系统会自动保存：

- 每个插槽片段完成时
- CSS 插槽中每个 `}` 输入完成时

## 预览与保存行为

- 预览页面不会随每次输入自动刷新
- 仅在主动保存时刷新预览
- 主动保存方式：`Ctrl + S`（Windows/Linux）、`Cmd + S`（macOS），或打字引擎命中 `[save]` 指令/插槽自动保存点

顶部状态说明：

- `已保存`：当前编辑内容与最近一次保存一致
- `未保存`：有未保存改动

## 录屏说明

### Web 录屏

- 通过浏览器能力录屏
- 输出通常为 WebM（视浏览器实现）

### 桌面端录屏

- 录制目标为应用窗口
- 直接生成 MP4（H.264）
- 无浏览器录屏权限弹窗

## 常见问题

### 1. 桌面端录屏启动失败（找不到窗口）

建议升级到最新代码版本。当前实现已从“标题全等匹配”升级为“多策略匹配”（标题归一化 + app 名称 + 焦点状态评分）。

### 2. 为什么我改了代码但预览没变？

这是当前设计：仅在保存时刷新预览。请按 `Ctrl/Cmd + S` 或使用 `[save]` 指令。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite
- 语法高亮：highlight.js
- 桌面端：Tauri v2（Rust）
- 编码封装：OpenH264 + minimp4

## 项目结构

```text
src/                 前端代码（组件、composables、工具）
src-tauri/           Tauri/Rust 后端
```

## 脚本命令

- `npm run dev`：启动 Web 开发环境
- `npm run build`：TypeScript 检查并构建前端
- `npm run preview`：预览前端构建产物
- `npm run tauri:dev`：启动桌面端开发环境
- `npm run tauri:build`：构建桌面端安装包

## License

MIT
