import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { highlightCode, insertCursorInHighlightedHTML } from '../utils/highlight'

export type PreviewMode = 'realtime' | 'final'

const _scriptOpen = '<' + 'script'
const _scriptClose = '</' + 'script>'
const _styleOpen = '<' + 'style'
const _styleClose = '</' + 'style>'

const _scriptOpenRe  = new RegExp(_scriptOpen + '[^>]*>', 'gi')
const _scriptCloseRe = new RegExp(_scriptClose, 'gi')

const _styleOpenRe  = new RegExp(_styleOpen + '[^>]*>', 'gi')
const _styleCloseRe = new RegExp(_styleClose, 'gi')

/**
 * Check if the HTML is safe for preview rendering.
 *
 * Only validates that opening and closing tags are balanced (script & style).
 * Brace-depth checks inside script blocks have been removed because they are
 * too restrictive during live editing — while the user types, braces are
 * almost always temporarily unbalanced, which would prevent the preview from
 * updating until the block is complete.
 */
function isCodeSafeForPreview(html: string): boolean {
  _scriptOpenRe.lastIndex = 0
  _scriptCloseRe.lastIndex = 0
  const scriptOpens = html.match(_scriptOpenRe) || []
  const scriptCloses = html.match(_scriptCloseRe) || []
  if (scriptOpens.length !== scriptCloses.length) return false

  _styleOpenRe.lastIndex = 0
  _styleCloseRe.lastIndex = 0
  const styleOpens = html.match(_styleOpenRe) || []
  const styleCloses = html.match(_styleCloseRe) || []
  if (styleOpens.length !== styleCloses.length) return false

  return true
}

export function useCodePreview(options: {
  code: Ref<string>
  targetCode: Ref<string>
  cursorPositionInCode: ComputedRef<number>
}) {
  const { code, targetCode, cursorPositionInCode } = options

  const previewCode = ref('')
  const previewExpanded = ref(false)
  const previewMode = ref<PreviewMode>('realtime')

  const highlightedCode = computed(() => {
    let html = highlightCode(code.value)
    const cursorPos = cursorPositionInCode.value
    if (cursorPos >= 0) {
      html = insertCursorInHighlightedHTML(html, cursorPos)
    }
    return html
  })

  // Watch current code for realtime mode updates
  watch(code, (newCode) => {
    if (previewMode.value === 'realtime' && isCodeSafeForPreview(newCode)) {
      previewCode.value = newCode
    }
  })

  // Watch targetCode for final mode — when target changes, update immediately
  watch(targetCode, (newTarget) => {
    if (previewMode.value === 'final' && newTarget) {
      previewCode.value = newTarget
    }
  })

  // When switching modes, update the preview content accordingly
  watch(previewMode, (mode) => {
    if (mode === 'final') {
      // Switch to final mode: show complete code if available, else current
      previewCode.value = targetCode.value || code.value
    } else {
      // Switch to realtime mode: show current code state
      if (isCodeSafeForPreview(code.value)) {
        previewCode.value = code.value
      }
    }
  })

  function togglePreview() {
    previewExpanded.value = !previewExpanded.value
  }

  function togglePreviewMode() {
    previewMode.value = previewMode.value === 'realtime' ? 'final' : 'realtime'
  }

  return {
    previewCode,
    previewExpanded,
    previewMode,
    highlightedCode,
    togglePreview,
    togglePreviewMode,
  }
}
