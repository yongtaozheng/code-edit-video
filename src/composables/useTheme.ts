import { ref, computed } from 'vue'
import type { ThemeDefinition } from '../types'
import { THEMES, DEFAULT_THEME_ID, getThemeById } from '../config/themes'

const STORAGE_KEY = 'code-edit-video-theme'

// ==================== hljs CSS 动态加载映射表 ====================
// 使用显式路径让 Vite 可以静态分析并正确打包

const hljsLoaders: Record<string, () => Promise<string>> = {
  'atom-one-dark': () =>
    import('highlight.js/styles/atom-one-dark.css?inline').then((m) => m.default),
  'github-dark': () =>
    import('highlight.js/styles/github-dark.css?inline').then((m) => m.default),
  github: () =>
    import('highlight.js/styles/github.css?inline').then((m) => m.default),
  monokai: () =>
    import('highlight.js/styles/monokai.css?inline').then((m) => m.default),
  'night-owl': () =>
    import('highlight.js/styles/night-owl.css?inline').then((m) => m.default),
  'tokyo-night-dark': () =>
    import('highlight.js/styles/tokyo-night-dark.css?inline').then((m) => m.default),
  nord: () =>
    import('highlight.js/styles/nord.css?inline').then((m) => m.default),
  vs2015: () =>
    import('highlight.js/styles/vs2015.css?inline').then((m) => m.default),
  vs: () =>
    import('highlight.js/styles/vs.css?inline').then((m) => m.default),
}

// ==================== 模块级单例状态 ====================

const currentThemeId = ref<string>(loadSavedThemeId())
let hljsStyleEl: HTMLStyleElement | null = null
let currentLoadedHljsStyle = ''

// ==================== 内部工具函数 ====================

function loadSavedThemeId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && getThemeById(saved)) return saved
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME_ID
}

function saveThemeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

/**
 * 动态加载 hljs 主题 CSS，注入/替换 <style> 标签
 */
async function loadHljsThemeCSS(hljsStyleName: string): Promise<void> {
  if (hljsStyleName === currentLoadedHljsStyle) return

  const loader = hljsLoaders[hljsStyleName]
  if (!loader) {
    console.warn(`[useTheme] hljs theme not found: ${hljsStyleName}`)
    return
  }

  const cssText = await loader()

  if (!hljsStyleEl) {
    hljsStyleEl = document.createElement('style')
    hljsStyleEl.id = 'hljs-theme'
    document.head.appendChild(hljsStyleEl)
  }

  hljsStyleEl.textContent = cssText
  currentLoadedHljsStyle = hljsStyleName
}

/**
 * 将主题编辑器配色写入 :root CSS 自定义属性
 */
function applyEditorColors(theme: ThemeDefinition) {
  const root = document.documentElement
  const e = theme.editor

  root.style.setProperty('--editor-bg', e.background)
  root.style.setProperty('--editor-text', e.textColor)
  root.style.setProperty('--editor-surface', e.surfaceColor)
  root.style.setProperty('--editor-surface-deep', e.surfaceDeepColor)
  root.style.setProperty('--editor-border', e.borderColor)
  root.style.setProperty('--editor-muted', e.mutedColor)
  root.style.setProperty('--editor-cursor', e.cursorColor)
  root.style.setProperty('--editor-cursor-glow', e.cursorGlow)
  root.style.setProperty('--editor-line-number', e.lineNumberColor)
  root.style.setProperty('--editor-selection', e.selectionColor)
  root.style.setProperty('--editor-placeholder', e.placeholderColor)
  root.style.setProperty('--editor-accent', e.accentColor)
  root.style.setProperty('--editor-scrollbar', e.scrollbarColor)
  root.style.setProperty('--editor-scrollbar-hover', e.scrollbarHoverColor)

  // 更新 color-scheme 让原生元素（滚动条、输入框等）匹配明暗
  root.style.setProperty('color-scheme', theme.mode)
}

// ==================== Composable ====================

export function useTheme() {
  const currentTheme = computed((): ThemeDefinition => {
    return getThemeById(currentThemeId.value) ?? THEMES[0]
  })

  /**
   * 切换主题
   */
  async function setTheme(id: string) {
    const theme = getThemeById(id)
    if (!theme) return

    currentThemeId.value = id
    saveThemeId(id)
    applyEditorColors(theme)
    await loadHljsThemeCSS(theme.hljsStyle)
  }

  /**
   * 初始化主题系统，加载已保存或默认主题
   * 应在应用启动时调用一次
   */
  async function initTheme() {
    const theme = currentTheme.value
    applyEditorColors(theme)
    await loadHljsThemeCSS(theme.hljsStyle)
  }

  return {
    // 状态
    themes: THEMES,
    currentThemeId,
    currentTheme,

    // 方法
    setTheme,
    initTheme,
  }
}
