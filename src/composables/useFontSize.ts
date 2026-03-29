import { ref, computed } from 'vue'

const STORAGE_KEY = 'code-edit-video-font-size'
const DEFAULT_FONT_SIZE = 14
const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 28
const STEP = 2
// 保持与原始 14px/22px 比例一致
const LINE_HEIGHT_RATIO = 22 / 14

// ==================== 模块级单例状态 ====================

const fontSize = ref<number>(loadSavedFontSize())

// ==================== 内部工具函数 ====================

function loadSavedFontSize(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const val = parseInt(saved, 10)
      if (!isNaN(val) && val >= MIN_FONT_SIZE && val <= MAX_FONT_SIZE) return val
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FONT_SIZE
}

function saveFontSize(size: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(size))
  } catch {
    /* ignore */
  }
}

function applyFontSizeCSS(size: number) {
  const root = document.documentElement
  const lineHeight = Math.round(size * LINE_HEIGHT_RATIO)
  root.style.setProperty('--editor-font-size', `${size}px`)
  root.style.setProperty('--editor-line-height', `${lineHeight}px`)
  root.style.setProperty('--editor-line-num-font-size', `${Math.max(size - 1, 11)}px`)
}

// ==================== Composable ====================

export function useFontSize() {
  const lineHeight = computed(() => Math.round(fontSize.value * LINE_HEIGHT_RATIO))

  const canZoomIn = computed(() => fontSize.value < MAX_FONT_SIZE)
  const canZoomOut = computed(() => fontSize.value > MIN_FONT_SIZE)

  function setFontSize(size: number) {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size))
    fontSize.value = clamped
    saveFontSize(clamped)
    applyFontSizeCSS(clamped)
  }

  function zoomIn() {
    setFontSize(fontSize.value + STEP)
  }

  function zoomOut() {
    setFontSize(fontSize.value - STEP)
  }

  function resetFontSize() {
    setFontSize(DEFAULT_FONT_SIZE)
  }

  /**
   * 初始化字体大小，应用已保存的设置到 CSS
   * 应在应用启动时调用一次
   */
  function initFontSize() {
    applyFontSizeCSS(fontSize.value)
  }

  return {
    fontSize,
    lineHeight,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetFontSize,
    setFontSize,
    initFontSize,
  }
}
