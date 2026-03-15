<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { PreviewMode } from '../../composables/useCodePreview'

const props = defineProps<{
  previewCode: string
  previewExpanded: boolean
  previewWidth: number
  previewHeight: number
  isResizing: boolean
  previewMode: PreviewMode
}>()

const emit = defineEmits<{
  togglePreview: []
  resizeStart: [e: MouseEvent]
  togglePreviewMode: []
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
let initialized = false
let lastScriptContent = ''

const _sOpen = '<' + 'script'
const _sClose = '</' + 'script>'
const _scriptBlockRe = new RegExp(_sOpen + '[^>]*>([\\s\\S]*?)' + _sClose, 'gi')

/**
 * Extract the concatenated text content of all <script> blocks.
 * Used to detect whether script logic has actually changed between updates.
 */
function extractScriptContent(html: string): string {
  _scriptBlockRe.lastIndex = 0
  let content = ''
  let m: RegExpExecArray | null
  while ((m = _scriptBlockRe.exec(html)) !== null) {
    content += m[1]
  }
  return content
}

/**
 * Preview update strategy:
 *
 * - First render (no scripts): doc.open/write/close.
 * - First render (has scripts) OR script content changed:
 *     → iframe.srcdoc = html  (full page refresh, most reliable for
 *       canvas/rAF/animation scripts — the browser handles execution).
 * - Scripts exist but unchanged (CSS-only edit):
 *     → update <head> only (preserves running animations).
 * - No scripts at all:
 *     → incremental DOM update for head + body (no flicker).
 *
 * While a srcdoc load is in progress, any further updates simply
 * overwrite srcdoc again — the browser naturally aborts the previous
 * load and only the last value takes effect.
 */
function updatePreview(html: string) {
  const iframe = iframeRef.value
  if (!iframe) return

  const newScriptContent = extractScriptContent(html)

  // --- Script content changed (or first time with scripts) → refresh iframe ---
  if (newScriptContent !== lastScriptContent && newScriptContent !== '') {
    // Syntax-check first: broken JS would blank the whole preview.
    // Only refresh when every <script> block parses without error.
    try { new Function(newScriptContent) } catch { return }

    iframe.srcdoc = html
    lastScriptContent = newScriptContent
    initialized = true
    return
  }

  // --- Try incremental update (srcdoc may still be loading → catch handles it) ---
  try {
    const doc = iframe.contentDocument
    if (!doc || !doc.head || !doc.body) throw new Error('No contentDocument access')

    if (!initialized) {
      // First render (no-script content)
      doc.open()
      doc.write(html)
      doc.close()
      initialized = true
      lastScriptContent = newScriptContent
      return
    }

    // Parse new HTML for incremental patching
    const parser = new DOMParser()
    const newDoc = parser.parseFromString(html, 'text/html')

    // Always patch <head> (styles, meta)
    doc.head.innerHTML = newDoc.head.innerHTML

    if (newScriptContent === '') {
      // No scripts → safe to patch body too
      doc.body.innerHTML = newDoc.body.innerHTML
    }
    // else: scripts exist but unchanged → don't touch body (preserve animations)

    lastScriptContent = newScriptContent
  } catch {
    // contentDocument not accessible (srcdoc still loading, or cross-origin)
    // → just (re-)set srcdoc; browser will display the latest value once ready
    iframe.srcdoc = html
    lastScriptContent = newScriptContent
    initialized = true
  }
}

// Initial render when the component mounts
onMounted(() => {
  if (props.previewCode) {
    updatePreview(props.previewCode)
  }
})

// Subsequent updates — watch for prop changes
watch(
  () => props.previewCode,
  (newCode) => {
    if (newCode) {
      updatePreview(newCode)
    }
  },
)
</script>

<template>
  <div
    class="preview-panel"
    :class="{ expanded: previewExpanded, resizing: isResizing }"
    :style="!previewExpanded ? { width: previewWidth + 'px', height: previewHeight + 'px' } : {}"
  >
    <div
      v-if="!previewExpanded"
      class="preview-resize-handle"
      @mousedown="emit('resizeStart', $event)"
    >
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.2">
        <line x1="1" y1="11" x2="11" y2="1" />
        <line x1="5" y1="11" x2="11" y2="5" />
        <line x1="9" y1="11" x2="11" y2="9" />
      </svg>
    </div>
    <div class="preview-header">
      <div class="preview-header-left" @click="emit('togglePreview')">
        <svg class="preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>Preview</span>
      </div>
      <div class="preview-header-right">
        <div class="preview-mode-toggle" @click.stop>
          <button
            class="preview-mode-btn"
            :class="{ active: previewMode === 'realtime' }"
            @click="previewMode !== 'realtime' && emit('togglePreviewMode')"
            title="实时跟随代码更新"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>实时</span>
          </button>
          <button
            class="preview-mode-btn"
            :class="{ active: previewMode === 'final' }"
            @click="previewMode !== 'final' && emit('togglePreviewMode')"
            title="始终显示完整代码效果"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>完整</span>
          </button>
        </div>
        <button class="expand-btn" :title="previewExpanded ? 'Collapse' : 'Expand'" @click.stop="emit('togglePreview')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <template v-if="!previewExpanded">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </template>
            <template v-else>
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </template>
          </svg>
        </button>
      </div>
    </div>
    <div class="preview-body">
      <iframe
        ref="iframeRef"
        sandbox="allow-scripts allow-modals allow-same-origin"
        class="preview-iframe"
        title="HTML Preview"
      />
    </div>
  </div>
</template>

<style scoped>
.preview-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  height: 280px;
  background: var(--editor-bg);
  border: 1px solid var(--editor-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-panel.resizing {
  transition: none;
}

.preview-panel.resizing .preview-iframe {
  pointer-events: none;
}

.preview-panel.expanded {
  width: 60vw;
  height: 70vh;
  bottom: 15vh;
  right: 20vw;
}

.preview-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 20px;
  height: 20px;
  cursor: nw-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--editor-muted);
  transition: color 0.2s;
  border-radius: 12px 0 0 0;
}

.preview-resize-handle:hover {
  color: var(--editor-text);
}

.preview-resize-handle svg {
  transform: rotate(90deg);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--editor-surface);
  border-bottom: 1px solid var(--editor-border);
  user-select: none;
  flex-shrink: 0;
}

.preview-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #a6e3a1;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.preview-header-left:hover {
  background: rgba(205, 214, 244, 0.08);
}

.preview-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-icon {
  width: 16px;
  height: 16px;
  color: #a6e3a1;
}

.preview-mode-toggle {
  display: flex;
  align-items: center;
  background: rgba(205, 214, 244, 0.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.preview-mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--editor-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.preview-mode-btn:hover:not(.active) {
  color: var(--editor-text);
  background: rgba(205, 214, 244, 0.08);
}

.preview-mode-btn.active {
  background: rgba(166, 227, 161, 0.15);
  color: #a6e3a1;
}

.expand-btn {
  background: none;
  border: none;
  color: var(--editor-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.expand-btn:hover {
  color: var(--editor-text);
  background: rgba(205, 214, 244, 0.1);
}

.preview-body {
  flex: 1;
  overflow: hidden;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

@media (max-width: 768px) {
  .preview-panel {
    width: calc(100vw - 32px);
    height: 240px;
    bottom: 16px;
    right: 16px;
  }

  .preview-panel.expanded {
    width: calc(100vw - 32px);
    height: 60vh;
    bottom: 16px;
    right: 16px;
  }
}
</style>
