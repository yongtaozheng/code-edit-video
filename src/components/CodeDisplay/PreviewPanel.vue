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
  isRecording: boolean
}>()

const emit = defineEmits<{
  togglePreview: []
  resizeStart: [e: MouseEvent]
  togglePreviewMode: []
}>()

const iframeRefA = ref<HTMLIFrameElement | null>(null)
const iframeRefB = ref<HTMLIFrameElement | null>(null)
const iframeLoading = ref(false)
const activeIframeKey = ref<'a' | 'b'>('a')
let initialized = false
let lastScriptContent = ''
let lastHtml = ''

// Throttle state for full srcdoc reloads (expensive operation)
const SRCDOC_THROTTLE_BASE_MS = 500
const SRCDOC_THROTTLE_EXPANDED_MS = 800
const SRCDOC_THROTTLE_EXPANDED_RECORDING_MS = 1200
const SRCDOC_THROTTLE_RECORDING_MS = 1000
let lastSrcdocTime = 0
let pendingSrcdocHtml: string | null = null
let srcdocTimer: ReturnType<typeof setTimeout> | null = null

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
 * Normalize script content by stripping whitespace and comments so that
 * cosmetic-only edits (new blank lines, comment changes) do not trigger
 * a full iframe reload.
 */
function normalizeScript(raw: string): string {
  return raw
    // strip single-line comments
    .replace(/\/\/[^\n]*/g, '')
    // strip multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // collapse all whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detect whether a script change would produce visible DOM changes.
 *
 * Conservative strategy: DEFAULT to "yes, it's visual" (trigger reload).
 * Only skip when we are VERY confident the change has no visual impact:
 *   - Whitespace / comment-only changes (caught by normalizeScript)
 *   - Pure variable declarations with no function calls or property writes
 *     e.g.  let x = 5;  const arr = [1,2,3];  var name = 'hello';
 *
 * Everything else (function calls, property assignments, canvas API,
 * requestAnimationFrame, etc.) triggers a reload — the throttle + fade
 * keeps the experience smooth.
 */
function isVisuallyMeaningfulChange(oldScript: string, newScript: string): boolean {
  const oldNorm = normalizeScript(oldScript)
  const newNorm = normalizeScript(newScript)

  // Whitespace / comment-only change → definitely no visual impact
  if (oldNorm === newNorm) return false

  // Code was appended (the common case during typing)
  if (newNorm.startsWith(oldNorm)) {
    const added = newNorm.slice(oldNorm.length).trim()
    if (!added) return false

    // Skip reload ONLY if the added code has:
    //  1. No function calls or grouping  → no ()
    //  2. No property writes             → no .identifier =
    // This covers: let x = 5; const arr = [1,2]; var s = 'hi';
    // But NOT:     el.innerHTML = 'x';  foo();  ctx.fillRect(...)
    const hasCalls = /[()]/.test(added)
    const hasPropWrite = /\.\w+\s*=/.test(added)
    if (!hasCalls && !hasPropWrite) return false
  }

  // Default: assume the change is visual → reload
  return true
}

/**
 * Keep current iframe visible while preloading next srcdoc in the hidden iframe,
 * then atomically swap visibility on load to avoid white-frame flashes.
 *
 * During recording, even small opacity transitions can look like flicker in
 * encoded videos, so loading fade is fully disabled while recording.
 */
function getActiveIframe(): HTMLIFrameElement | null {
  return activeIframeKey.value === 'a' ? iframeRefA.value : iframeRefB.value
}

function getStandbyIframe(): HTMLIFrameElement | null {
  return activeIframeKey.value === 'a' ? iframeRefB.value : iframeRefA.value
}

function doSrcdocReload(html: string) {
  const active = getActiveIframe()
  const standby = getStandbyIframe()
  if (!active || !standby) return

  const useLoadingFade = !props.isRecording

  if (useLoadingFade) {
    iframeLoading.value = true
  } else {
    iframeLoading.value = false
  }

  standby.onload = () => {
    standby.onload = null
    requestAnimationFrame(() => {
      activeIframeKey.value = activeIframeKey.value === 'a' ? 'b' : 'a'
      iframeLoading.value = false
    })
  }
  standby.srcdoc = html
  lastSrcdocTime = Date.now()
}

function getSrcdocThrottleMs(): number {
  if (props.isRecording) {
    if (props.previewExpanded) return SRCDOC_THROTTLE_EXPANDED_RECORDING_MS
    return SRCDOC_THROTTLE_RECORDING_MS
  }
  if (props.previewExpanded && props.isRecording) {
    return SRCDOC_THROTTLE_EXPANDED_RECORDING_MS
  }
  if (props.previewExpanded) {
    return SRCDOC_THROTTLE_EXPANDED_MS
  }
  return SRCDOC_THROTTLE_BASE_MS
}

/**
 * Throttled srcdoc reload: limits full iframe refreshes to at most once
 * per SRCDOC_THROTTLE_MS. If a reload is requested during cooldown, the
 * latest HTML is queued and applied when the cooldown expires.
 *
 * This keeps incremental DOM patches (CSS, no-script body) fully real-time
 * while only rate-limiting the expensive full-page reloads.
 */
function smoothSrcdocReload(html: string) {
  const throttleMs = getSrcdocThrottleMs()
  const now = Date.now()
  const elapsed = now - lastSrcdocTime

  if (elapsed >= throttleMs) {
    // Cooldown has passed → reload immediately
    if (srcdocTimer) { clearTimeout(srcdocTimer); srcdocTimer = null }
    pendingSrcdocHtml = null
    doSrcdocReload(html)
  } else {
    // Still in cooldown → queue the latest HTML
    pendingSrcdocHtml = html
    if (!srcdocTimer) {
      srcdocTimer = setTimeout(() => {
        srcdocTimer = null
        if (pendingSrcdocHtml && getActiveIframe()) {
          const pending = pendingSrcdocHtml
          pendingSrcdocHtml = null
          doSrcdocReload(pending)
        }
      }, throttleMs - elapsed)
    }
  }
}

/**
 * Preview update strategy (optimized to reduce flicker):
 *
 * - First render (no scripts): doc.open/write/close.
 * - First render (has scripts) OR script content changed in a
 *   visually meaningful way:
 *     → smooth srcdoc reload with fade transition.
 * - Script changed but only non-visual edits (variable declarations,
 *   comments, etc.):
 *     → defer full reload; update head only.
 * - Scripts exist but unchanged (CSS-only edit):
 *     → update <head> only (preserves running animations).
 * - No scripts at all:
 *     → incremental DOM update for head + body (no flicker).
 */
function updatePreview(html: string) {
  const iframe = getActiveIframe()
  if (!iframe) return

  // Skip if the HTML is exactly the same (can happen with debounce)
  if (html === lastHtml && initialized) return
  lastHtml = html

  const newScriptContent = extractScriptContent(html)

  // --- Script content changed (or first time with scripts) → refresh iframe ---
  if (newScriptContent !== lastScriptContent && newScriptContent !== '') {
    // Syntax-check first: broken JS would blank the whole preview.
    // Only refresh when every <script> block parses without error.
    try { new Function(newScriptContent) } catch { return }

    // Check if the change is visually meaningful
    if (!initialized || isVisuallyMeaningfulChange(lastScriptContent, newScriptContent)) {
      smoothSrcdocReload(html)
      lastScriptContent = newScriptContent
      initialized = true
      return
    }

    // Non-visual script change: update stored script but only patch head (CSS)
    lastScriptContent = newScriptContent
    // Fall through to incremental update for CSS changes
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
    // → smooth reload instead of abrupt srcdoc swap
    smoothSrcdocReload(html)
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
    :class="{ expanded: previewExpanded, resizing: isResizing, recording: isRecording }"
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
        ref="iframeRefA"
        sandbox="allow-scripts allow-modals allow-same-origin"
        class="preview-iframe"
        :class="{ active: activeIframeKey === 'a', 'iframe-loading': iframeLoading && activeIframeKey === 'a' }"
        title="HTML Preview A"
      />
      <iframe
        ref="iframeRefB"
        sandbox="allow-scripts allow-modals allow-same-origin"
        class="preview-iframe"
        :class="{ active: activeIframeKey === 'b', 'iframe-loading': iframeLoading && activeIframeKey === 'b' }"
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
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  contain: paint;
  isolation: isolate;
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: width, height;
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
  position: relative;
  background: #fff;
}

.preview-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  border: none;
  background: #fff;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.preview-iframe.active {
  opacity: 1;
  pointer-events: auto;
}

.preview-iframe.iframe-loading {
  opacity: 0.94;
}

.preview-panel.recording .preview-iframe {
  transition: none;
}

.preview-panel.recording {
  transition: none;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
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
