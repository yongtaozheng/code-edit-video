<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import 'highlight.js/styles/atom-one-dark.css'

hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)

// ==================== Editor State ====================
const code = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const codeDisplayRef = ref<HTMLElement | null>(null)
const lineNumbersRef = ref<HTMLElement | null>(null)
const previewExpanded = ref(false)

// ==================== Typing Simulation State ====================
const showPasteModal = ref(false)
const pasteCode = ref('')
const pasteTextareaRef = ref<HTMLTextAreaElement | null>(null)

// Typing engine
const targetCode = ref('')
const currentIndex = ref(0)
const isTyping = ref(false)
const isPaused = ref(false)
const typingSpeed = ref(50) // base delay in ms
const typingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const typingComplete = ref(false)

// ==================== Computed Properties ====================
const highlightedCode = computed(() => {
  try {
    const result = hljs.highlight(code.value, { language: 'xml' })
    return result.value
  } catch {
    return code.value
  }
})

const lineNumbers = computed(() => {
  const lines = code.value.split('\n')
  return lines.map((_, i) => i + 1)
})

const typingProgress = computed(() => {
  if (!targetCode.value) return 0
  return Math.round((currentIndex.value / targetCode.value.length) * 100)
})

const typingStatusText = computed(() => {
  if (typingComplete.value) return '已完成'
  if (isPaused.value) return '已暂停'
  if (isTyping.value) return '输入中...'
  return '就绪'
})

const speedLabel = computed(() => {
  if (typingSpeed.value <= 20) return '极快'
  if (typingSpeed.value <= 40) return '快速'
  if (typingSpeed.value <= 70) return '正常'
  if (typingSpeed.value <= 120) return '慢速'
  return '极慢'
})

// ==================== Editor Functions ====================
function syncScroll() {
  if (textareaRef.value && codeDisplayRef.value) {
    codeDisplayRef.value.scrollTop = textareaRef.value.scrollTop
    codeDisplayRef.value.scrollLeft = textareaRef.value.scrollLeft
  }
  // Also sync line numbers
  if (textareaRef.value && lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

function handleTab(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    code.value = code.value.substring(0, start) + '  ' + code.value.substring(end)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    })
  }
}

function togglePreview() {
  previewExpanded.value = !previewExpanded.value
}

function scrollToBottom() {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.scrollTop = textareaRef.value.scrollHeight
    }
    if (codeDisplayRef.value) {
      codeDisplayRef.value.scrollTop = codeDisplayRef.value.scrollHeight
    }
    if (lineNumbersRef.value) {
      lineNumbersRef.value.scrollTop = lineNumbersRef.value.scrollHeight
    }
  })
}

// ==================== Typing Simulation Engine ====================
function getRandomDelay(char: string, nextChar: string): number {
  const base = typingSpeed.value
  // Add natural variation: -40% to +80%
  const variation = base * (0.6 + Math.random() * 1.2)

  // Longer pause after certain characters
  if (char === '\n') return variation * 2.5 // Newline = longer pause
  if (char === '>' || char === ';' || char === '}') return variation * 1.5
  if (char === ' ' && nextChar === ' ') return variation * 0.3 // Fast for indentation
  if (char === '<' || char === '{') return variation * 1.3

  return variation
}

function typeNextChar() {
  if (!isTyping.value || isPaused.value) return
  if (currentIndex.value >= targetCode.value.length) {
    // Typing complete
    isTyping.value = false
    typingComplete.value = true
    return
  }

  const char = targetCode.value[currentIndex.value]
  const nextChar = targetCode.value[currentIndex.value + 1] || ''
  code.value += char
  currentIndex.value++

  // Auto-scroll to keep current position visible
  scrollToBottom()

  const delay = getRandomDelay(char, nextChar)
  typingTimer.value = setTimeout(typeNextChar, delay)
}

function openPasteModal() {
  pasteCode.value = ''
  showPasteModal.value = true
  nextTick(() => {
    pasteTextareaRef.value?.focus()
  })
}

function closePasteModal() {
  showPasteModal.value = false
  pasteCode.value = ''
}

function startTyping() {
  if (!pasteCode.value.trim()) return

  targetCode.value = pasteCode.value
  currentIndex.value = 0
  code.value = ''
  isTyping.value = true
  isPaused.value = false
  typingComplete.value = false
  showPasteModal.value = false

  // Small delay before starting to type
  typingTimer.value = setTimeout(typeNextChar, 500)
}

function pauseTyping() {
  isPaused.value = true
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
    typingTimer.value = null
  }
}

function resumeTyping() {
  if (!isTyping.value || !isPaused.value) return
  isPaused.value = false
  typeNextChar()
}

function togglePause() {
  if (isPaused.value) {
    resumeTyping()
  } else {
    pauseTyping()
  }
}

function stopTyping() {
  isTyping.value = false
  isPaused.value = false
  typingComplete.value = false
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
    typingTimer.value = null
  }
  targetCode.value = ''
  currentIndex.value = 0
}

function finishInstantly() {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
    typingTimer.value = null
  }
  code.value = targetCode.value
  currentIndex.value = targetCode.value.length
  isTyping.value = false
  typingComplete.value = true
  scrollToBottom()
}

// Watch speed changes: if currently typing and not paused, restart timer with new speed
watch(typingSpeed, () => {
  if (isTyping.value && !isPaused.value) {
    if (typingTimer.value) {
      clearTimeout(typingTimer.value)
    }
    typeNextChar()
  }
})

// Handle keyboard shortcut for paste modal
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showPasteModal.value) {
    closePasteModal()
  }
  // Space to toggle pause when typing (not in modal)
  if (e.code === 'Space' && isTyping.value && !showPasteModal.value) {
    // Only if not focused on an input
    const active = document.activeElement
    if (active?.tagName !== 'TEXTAREA' && active?.tagName !== 'INPUT') {
      e.preventDefault()
      togglePause()
    }
  }
}

// ==================== Lifecycle ====================
onMounted(() => {
  if (textareaRef.value) {
    textareaRef.value.focus()
  }
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="code-display-container">
    <!-- Header Bar -->
    <header class="header-bar">
      <div class="header-left">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <span class="header-title">HTML Code Viewer</span>
      </div>
      <div class="header-right">
        <button class="typing-btn" @click="openPasteModal" :disabled="isTyping && !typingComplete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>模拟手打</span>
        </button>
        <span class="lang-badge">HTML</span>
        <span class="line-count">{{ lineNumbers.length }} lines</span>
      </div>
    </header>

    <!-- Typing Control Bar -->
    <div class="typing-control-bar" v-if="isTyping || typingComplete">
      <div class="control-left">
        <button
          v-if="!typingComplete"
          class="ctrl-btn"
          @click="togglePause"
          :title="isPaused ? '继续 (Space)' : '暂停 (Space)'"
        >
          <!-- Pause icon -->
          <svg v-if="!isPaused" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          <!-- Play icon -->
          <svg v-else viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <button v-if="!typingComplete" class="ctrl-btn" @click="finishInstantly" title="立即完成">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <polygon points="5 3 19 12 5 21 5 3" />
            <rect x="18" y="3" width="3" height="18" rx="1" />
          </svg>
        </button>
        <button class="ctrl-btn ctrl-btn-stop" @click="stopTyping" title="停止并清除">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
        <span class="typing-status" :class="{ 'status-complete': typingComplete, 'status-paused': isPaused }">
          {{ typingStatusText }}
        </span>
      </div>

      <div class="control-center">
        <div class="speed-control" v-if="!typingComplete">
          <span class="speed-label">速度</span>
          <input
            type="range"
            min="5"
            max="200"
            :value="200 - typingSpeed"
            @input="typingSpeed = 200 - Number(($event.target as HTMLInputElement).value)"
            class="speed-slider"
          />
          <span class="speed-value">{{ speedLabel }}</span>
        </div>
      </div>

      <div class="control-right">
        <div class="progress-info">
          <span class="progress-text">{{ currentIndex }} / {{ targetCode.length }}</span>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: typingProgress + '%' }"></div>
          </div>
          <span class="progress-percent">{{ typingProgress }}%</span>
        </div>
      </div>
    </div>

    <!-- Editor Area -->
    <div class="editor-wrapper">
      <!-- Line Numbers -->
      <div class="line-numbers" ref="lineNumbersRef">
        <div v-for="num in lineNumbers" :key="num" class="line-num">{{ num }}</div>
      </div>

      <!-- Code Layers -->
      <div class="code-area">
        <!-- Highlighted display layer -->
        <pre
          ref="codeDisplayRef"
          class="code-highlight"
        ><code v-html="highlightedCode"></code></pre>

        <!-- Transparent textarea on top for editing -->
        <textarea
          ref="textareaRef"
          v-model="code"
          class="code-input"
          @scroll="syncScroll"
          @keydown="handleTab"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          :readonly="isTyping && !typingComplete"
          placeholder="点击右上角「模拟手打」按钮，粘贴代码开始模拟打字..."
        />
      </div>
    </div>

    <!-- Preview Panel -->
    <div class="preview-panel" :class="{ expanded: previewExpanded }">
      <div class="preview-header" @click="togglePreview">
        <div class="preview-header-left">
          <svg class="preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>Preview</span>
        </div>
        <button class="expand-btn" :title="previewExpanded ? 'Collapse' : 'Expand'">
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
      <div class="preview-body">
        <iframe
          :srcdoc="code"
          sandbox="allow-scripts allow-modals"
          class="preview-iframe"
          title="HTML Preview"
        />
      </div>
    </div>

    <!-- Paste Modal -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showPasteModal" @click.self="closePasteModal">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title-group">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              <h3>粘贴要模拟输入的代码</h3>
            </div>
            <button class="modal-close" @click="closePasteModal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <textarea
              ref="pasteTextareaRef"
              v-model="pasteCode"
              class="paste-textarea"
              placeholder="在此粘贴 HTML 代码...&#10;&#10;粘贴后点击「开始模拟」即可逐字打出代码，&#10;用于录制视频展示手打代码过程。"
              spellcheck="false"
            />
          </div>
          <div class="modal-footer">
            <div class="modal-footer-left">
              <span class="char-count" v-if="pasteCode">
                {{ pasteCode.length }} 字符 · {{ pasteCode.split('\n').length }} 行
              </span>
            </div>
            <div class="modal-footer-right">
              <button class="modal-btn modal-btn-cancel" @click="closePasteModal">取消</button>
              <button
                class="modal-btn modal-btn-start"
                @click="startTyping"
                :disabled="!pasteCode.trim()"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                开始模拟
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.code-display-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
  color: #cdd6f4;
  overflow: hidden;
  position: relative;
}

/* Header */
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #181825;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 20px;
  height: 20px;
  color: #cba6f7;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #cdd6f4;
  font-family: system-ui, -apple-system, sans-serif;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.typing-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid rgba(203, 166, 247, 0.3);
  background: rgba(203, 166, 247, 0.1);
  color: #cba6f7;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.typing-btn:hover:not(:disabled) {
  background: rgba(203, 166, 247, 0.2);
  border-color: rgba(203, 166, 247, 0.5);
}

.typing-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lang-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(203, 166, 247, 0.15);
  color: #cba6f7;
  font-family: system-ui, sans-serif;
}

.line-count {
  font-size: 12px;
  color: #6c7086;
  font-family: system-ui, sans-serif;
}

/* ==================== Typing Control Bar ==================== */
.typing-control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: #11111b;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
  gap: 16px;
}

.control-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #313244;
  background: rgba(205, 214, 244, 0.05);
  color: #cdd6f4;
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-btn:hover {
  background: rgba(205, 214, 244, 0.12);
  border-color: #45475a;
}

.ctrl-btn-stop {
  color: #f38ba8;
  border-color: rgba(243, 139, 168, 0.3);
}

.ctrl-btn-stop:hover {
  background: rgba(243, 139, 168, 0.12);
  border-color: rgba(243, 139, 168, 0.5);
}

.typing-status {
  font-size: 12px;
  font-weight: 600;
  color: #a6e3a1;
  font-family: system-ui, sans-serif;
  margin-left: 4px;
}

.typing-status.status-paused {
  color: #f9e2af;
}

.typing-status.status-complete {
  color: #89b4fa;
}

.control-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.speed-label {
  font-size: 12px;
  color: #6c7086;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
}

.speed-slider {
  width: 120px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #313244;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #cba6f7;
  cursor: pointer;
  border: 2px solid #1e1e2e;
  box-shadow: 0 0 4px rgba(203, 166, 247, 0.4);
}

.speed-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #cba6f7;
  cursor: pointer;
  border: 2px solid #1e1e2e;
}

.speed-value {
  font-size: 12px;
  font-weight: 600;
  color: #cba6f7;
  font-family: system-ui, sans-serif;
  min-width: 36px;
  text-align: center;
}

.control-right {
  display: flex;
  align-items: center;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-text {
  font-size: 11px;
  color: #6c7086;
  font-family: ui-monospace, 'SF Mono', monospace;
  white-space: nowrap;
}

.progress-bar {
  width: 100px;
  height: 4px;
  background: #313244;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #cba6f7, #89b4fa);
  border-radius: 2px;
  transition: width 0.15s ease;
}

.progress-percent {
  font-size: 12px;
  font-weight: 600;
  color: #89b4fa;
  font-family: system-ui, sans-serif;
  min-width: 36px;
  text-align: right;
}

/* Editor */
.editor-wrapper {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.line-numbers {
  width: 56px;
  flex-shrink: 0;
  padding: 16px 0;
  background: #181825;
  border-right: 1px solid #313244;
  overflow: hidden;
  user-select: none;
}

.line-num {
  height: 22px;
  line-height: 22px;
  font-size: 13px;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  color: #45475a;
  text-align: right;
  padding-right: 16px;
}

.code-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.code-highlight,
.code-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 16px;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 14px;
  line-height: 22px;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  box-sizing: border-box;
}

.code-highlight {
  background: transparent;
  pointer-events: none;
  z-index: 1;
  color: #cdd6f4;
}

.code-highlight code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  background: none;
  padding: 0;
}

.code-input {
  background: transparent;
  color: transparent;
  caret-color: #f5e0dc;
  border: none;
  outline: none;
  resize: none;
  z-index: 2;
  -webkit-text-fill-color: transparent;
}

.code-input::selection {
  background: rgba(203, 166, 247, 0.2);
  -webkit-text-fill-color: transparent;
}

.code-input::placeholder {
  -webkit-text-fill-color: #45475a;
  color: #45475a;
}

/* Preview Panel */
.preview-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  height: 280px;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-panel.expanded {
  width: 60vw;
  height: 70vh;
  bottom: 15vh;
  right: 20vw;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #181825;
  border-bottom: 1px solid #313244;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.preview-header:hover {
  background: #1e1e2e;
}

.preview-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #a6e3a1;
  font-family: system-ui, sans-serif;
}

.preview-icon {
  width: 16px;
  height: 16px;
  color: #a6e3a1;
}

.expand-btn {
  background: none;
  border: none;
  color: #6c7086;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.expand-btn:hover {
  color: #cdd6f4;
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

/* ==================== Paste Modal ==================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  width: 680px;
  max-width: 90vw;
  max-height: 80vh;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid #313244;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #cba6f7;
}

.modal-title-group h3 {
  font-size: 16px;
  font-weight: 700;
  color: #cdd6f4;
  font-family: system-ui, sans-serif;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #6c7086;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close:hover {
  background: rgba(243, 139, 168, 0.1);
  color: #f38ba8;
}

.modal-body {
  flex: 1;
  padding: 16px 24px;
  overflow: hidden;
}

.paste-textarea {
  width: 100%;
  height: 320px;
  background: #11111b;
  border: 1px solid #313244;
  border-radius: 10px;
  padding: 16px;
  color: #cdd6f4;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 20px;
  resize: none;
  outline: none;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  transition: border-color 0.2s;
}

.paste-textarea:focus {
  border-color: rgba(203, 166, 247, 0.5);
}

.paste-textarea::placeholder {
  color: #45475a;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid #313244;
}

.modal-footer-left {
  display: flex;
  align-items: center;
}

.char-count {
  font-size: 12px;
  color: #6c7086;
  font-family: system-ui, sans-serif;
}

.modal-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-btn-cancel {
  background: rgba(205, 214, 244, 0.05);
  color: #6c7086;
  border: 1px solid #313244;
}

.modal-btn-cancel:hover {
  background: rgba(205, 214, 244, 0.1);
  color: #cdd6f4;
}

.modal-btn-start {
  background: linear-gradient(135deg, #cba6f7, #89b4fa);
  color: #11111b;
}

.modal-btn-start:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 16px rgba(203, 166, 247, 0.3);
}

.modal-btn-start:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Scrollbar styling */
.code-highlight::-webkit-scrollbar,
.code-input::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.code-highlight::-webkit-scrollbar-track,
.code-input::-webkit-scrollbar-track {
  background: transparent;
}

.code-highlight::-webkit-scrollbar-thumb,
.code-input::-webkit-scrollbar-thumb {
  background: #313244;
  border-radius: 4px;
}

.code-highlight::-webkit-scrollbar-thumb:hover,
.code-input::-webkit-scrollbar-thumb:hover {
  background: #45475a;
}

.paste-textarea::-webkit-scrollbar {
  width: 6px;
}

.paste-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.paste-textarea::-webkit-scrollbar-thumb {
  background: #313244;
  border-radius: 3px;
}

/* Responsive */
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

  .line-numbers {
    width: 44px;
  }

  .line-num {
    font-size: 12px;
    padding-right: 12px;
  }

  .typing-control-bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }

  .speed-slider {
    width: 80px;
  }

  .progress-bar {
    width: 60px;
  }

  .modal-content {
    width: 95vw;
    max-height: 90vh;
  }

  .paste-textarea {
    height: 240px;
  }
}
</style>
