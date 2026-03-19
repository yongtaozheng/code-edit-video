# Code Edit Video

[中文文档](./README.md) | English

Code Edit Video is a tool for creating "code typing demo videos" with simulated keystrokes, recording, and HTML preview.

## Highlights

- Auto/manual typing modes
- Inline action markers (`[pause]` / `[quick]` / `[save]` / `[ignore]`)
- Slot-based framework mode (show scaffold first, then fill chunks)
- Web and desktop recording workflows
- Top status indicator: `Saved` / `Unsaved`
- Preview refreshes only on explicit save (`Ctrl/Cmd + S`)

## Quick Start (Web)

### Requirements

- Node.js >= 16

### Install & Run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

### Build

```bash
npm run build
npm run preview
```

## Desktop App (Tauri)

Desktop mode provides a native recording pipeline: window capture -> H.264 encode -> MP4 output.

### Extra Requirements

- Rust stable
- A system C compiler (required by OpenH264 source build)

### Run in Development

```bash
npm run tauri:dev
```

### Build Installers

```bash
npm run tauri:build
```

Artifacts: `src-tauri/target/release/bundle/`

## Typing Modes & Markers

### Typing Modes

- Auto mode: continuous typing with configurable speed
- Manual mode: fixed characters per key press

### Inline Action Markers

You can append action markers at line ends in comments (`<!-- -->`, `/* */`, `//`, `#` are all supported):

- `[pause]`: pause when this line is reached
- `[quick]`: type the whole line instantly
- `[save]`: trigger an explicit save after this line is completed
- `[ignore]`: skip this line in the typing output

Example:

```html
<div class="card">Hello</div> <!--[save]-->
```

```css
.title { color: #333; } /*[quick]*/
```

```js
console.log('step 1') // [pause]
```

## Slot Framework Mode

Use slot mode when you want to reveal structure first, then fill content progressively.

- `[slot] ... [/slot]`: define a chunk
- `[slot:2]`: explicit execution order (smaller number first)
- `[slot:nopause]`: do not pause after this chunk
- `[slot:1:nopause]`: combined parameters

In slot mode, save is also triggered automatically:

- when each slot chunk is fully typed
- when each CSS closing brace `}` is typed inside CSS slots

## Preview & Save Behavior

- Preview does not auto-refresh on every character change
- Preview refreshes only when an explicit save happens
- Explicit save can be triggered by `Ctrl + S` (Windows/Linux), `Cmd + S` (macOS), or typing-engine triggers (`[save]` markers and slot auto-save points)

Top status semantics:

- `Saved`: current editor content matches the latest saved snapshot
- `Unsaved`: there are unsaved edits

## Recording Notes

### Web Recording

- Uses browser recording capabilities
- Output is typically WebM (depends on browser implementation)

### Desktop Recording

- Targets the application window directly
- Outputs MP4 (H.264)
- No browser screen-capture permission popup

## FAQ

### 1. Desktop recording fails to start (window not found)

Use the latest version. The matcher now uses a robust strategy (normalized title + app name + focus scoring), not strict title equality only.

### 2. Why doesn't preview update while typing?

This is by design. Preview updates only on save. Press `Ctrl/Cmd + S` or use `[save]` markers.

## Tech Stack

- Frontend: Vue 3 + TypeScript + Vite
- Highlighting: highlight.js
- Desktop: Tauri v2 (Rust)
- Encoding/Muxing: OpenH264 + minimp4

## Project Layout

```text
src/                 Frontend code (components, composables, utils)
src-tauri/           Tauri/Rust backend
```

## Scripts

- `npm run dev`: run web development server
- `npm run build`: TypeScript check and frontend build
- `npm run preview`: preview built frontend assets
- `npm run tauri:dev`: run desktop app in development
- `npm run tauri:build`: build desktop installers

## License

MIT
