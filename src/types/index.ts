export type TypingMode = 'auto' | 'manual'
export type SpeedPreset = 'slow' | 'medium' | 'fast'

export interface LineAction {
  type: 'pause' | 'quick' | 'ignore' | 'save'
  lineStart: number
  lineEnd: number
  cleanLine: string
}

export interface FrameworkSlot {
  content: string
  insertPosition: number
  order: number
  pauseAfter: boolean
}

export interface SplitResult {
  html: string
  css: string
  js: string
}

// ==================== Theme ====================

export type ThemeMode = 'dark' | 'light'

export interface ThemeEditorColors {
  /** 编辑器主背景 */
  background: string
  /** 主文字颜色 */
  textColor: string
  /** 侧栏 / Header 背景 */
  surfaceColor: string
  /** 更深层背景（控制栏等） */
  surfaceDeepColor: string
  /** 边框颜色 */
  borderColor: string
  /** 次要/弱化文字 */
  mutedColor: string
  /** 光标颜色 */
  cursorColor: string
  /** 光标发光阴影 */
  cursorGlow: string
  /** 行号颜色 */
  lineNumberColor: string
  /** 选区高亮 */
  selectionColor: string
  /** placeholder 文字颜色 */
  placeholderColor: string
  /** 强调色 */
  accentColor: string
  /** 滚动条颜色 */
  scrollbarColor: string
  /** 滚动条悬停颜色 */
  scrollbarHoverColor: string
}

export interface ThemeDefinition {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  label: string
  /** 明暗模式 */
  mode: ThemeMode
  /** highlight.js CSS 文件名（不含 .css） */
  hljsStyle: string
  /** 编辑器配色 */
  editor: ThemeEditorColors
}
