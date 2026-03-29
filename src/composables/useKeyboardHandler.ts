import type { Ref } from 'vue'
import type { TypingMode } from '../types'

export function useKeyboardHandler(options: {
  showPasteModal: Ref<boolean>
  isTyping: Ref<boolean>
  typingMode: Ref<TypingMode>
  typingComplete: Ref<boolean>
  isPaused: Ref<boolean>
  closePasteModal: () => void
  typeManualChunk: () => void
  togglePause: () => void
  requestSavePreview?: () => void
  zoomIn?: () => void
  zoomOut?: () => void
  resetFontSize?: () => void
}) {
  function handleGlobalKeydown(e: KeyboardEvent) {
    // Escape closes modal
    if (e.key === 'Escape' && options.showPasteModal.value) {
      options.closePasteModal()
      return
    }

    // Don't intercept if modal is open
    if (options.showPasteModal.value) return

    // Font size zoom shortcuts: Ctrl+= / Ctrl+- / Ctrl+0
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        options.zoomIn?.()
        return
      }
      if (e.key === '-') {
        e.preventDefault()
        options.zoomOut?.()
        return
      }
      if (e.key === '0') {
        e.preventDefault()
        options.resetFontSize?.()
        return
      }
    }

    // Manual save shortcut: refresh preview
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      options.requestSavePreview?.()
      return
    }

    // Manual mode: any key types the next chunk
    if (options.isTyping.value && options.typingMode.value === 'manual' && !options.typingComplete.value) {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock'].includes(e.key)) return
      if (e.ctrlKey || e.metaKey) return

      e.preventDefault()
      options.typeManualChunk()
      return
    }

    // Auto mode: Space to toggle pause
    if (options.isTyping.value && options.typingMode.value === 'auto' && !options.typingComplete.value) {
      if (e.code === 'Space') {
        const active = document.activeElement
        if (active?.tagName !== 'TEXTAREA' && active?.tagName !== 'INPUT') {
          e.preventDefault()
          options.togglePause()
        }
      }
    }
  }

  return {
    handleGlobalKeydown,
  }
}
