<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { SpeedPreset } from '../types'
import { initHighlighter } from '../utils/highlight'

// Composables
import { useTypingEngine } from '../composables/useTypingEngine'
import { useRecording } from '../composables/useRecording'
import { useCodePreview } from '../composables/useCodePreview'
import { usePreviewResize } from '../composables/usePreviewResize'
import { useContentSplit } from '../composables/useContentSplit'
import { useSlotConfig } from '../composables/useSlotConfig'
import { useEditorScroll } from '../composables/useEditorScroll'
import { useKeyboardHandler } from '../composables/useKeyboardHandler'

// Sub-components
import TypingControlBar from './CodeDisplay/TypingControlBar.vue'
import PasteModal from './CodeDisplay/PasteModal.vue'
import SplitModal from './CodeDisplay/SplitModal.vue'
import SlotConfigModal from './CodeDisplay/SlotConfigModal.vue'
import PreviewPanel from './CodeDisplay/PreviewPanel.vue'
import ThemeSelector from './CodeDisplay/ThemeSelector.vue'

// Initialize highlight.js languages
initHighlighter()

// ==================== Shared State ====================
const code = ref('')
const showPasteModal = ref(false)
const pasteCode = ref('')
const lastSavedCode = ref('')
const isDocumentSaved = ref(true)

// ==================== Composable Initialization ====================

const recording = useRecording()

// Late-bind scrollToCursor to break circular dependency
let scrollToCursorFn: () => void = () => {}

const typingEngine = useTypingEngine({
  code,
  onTypingComplete: () => recording.autoStopRecordingIfNeeded(),
  scrollToCursor: () => scrollToCursorFn(),
  onSaveRequested: () => handleSavePreview(),
})

const editorScroll = useEditorScroll({
  code,
  isFrameworkMode: typingEngine.isFrameworkMode,
  currentSlotIndex: typingEngine.currentSlotIndex,
  slotExecOrder: typingEngine.slotExecOrder,
  frameworkSlots: typingEngine.frameworkSlots,
  currentSlotCharIndex: typingEngine.currentSlotCharIndex,
})

// Now wire the late-bound scroll function
scrollToCursorFn = editorScroll.scrollToCursor

const preview = useCodePreview({
  code,
  targetCode: typingEngine.targetCode,
  cursorPositionInCode: typingEngine.cursorPositionInCode,
})

const resize = usePreviewResize()

const contentSplit = useContentSplit({ code })

const slotConfig = useSlotConfig({
  onUseCode: (generated: string) => {
    pasteCode.value = generated
    showPasteModal.value = true
  },
})

const keyboard = useKeyboardHandler({
  showPasteModal,
  isTyping: typingEngine.isTyping,
  typingMode: typingEngine.typingMode,
  typingComplete: typingEngine.typingComplete,
  isPaused: typingEngine.isPaused,
  closePasteModal: () => closePasteModal(),
  typeManualChunk: typingEngine.typeManualChunk,
  togglePause: typingEngine.togglePause,
  requestSavePreview: handleSavePreview,
})

watch(code, (newCode) => {
  isDocumentSaved.value = newCode === lastSavedCode.value
})

// ==================== Error Auto-dismiss ====================
watch(recording.recordingError, (val) => {
  if (val) {
    setTimeout(() => {
      recording.recordingError.value = ''
    }, 6000)
  }
})

watch(typingEngine.typingError, (val) => {
  if (val) {
    setTimeout(() => {
      typingEngine.typingError.value = ''
    }, 6000)
  }
})

// ==================== Paste Modal Functions ====================
function openPasteModal() {
  pasteCode.value = ''
  showPasteModal.value = true
}

function closePasteModal() {
  showPasteModal.value = false
  pasteCode.value = ''
}

async function handleStartTyping() {
  if (!pasteCode.value.trim()) return
  if (recording.autoRecord.value) {
    const started = await recording.startRecording(true)
    if (!started) {
      recording.autoRecord.value = false
    }
  }
  typingEngine.startTyping(pasteCode.value)
  showPasteModal.value = false
}

function handleSavePreview() {
  const ok = preview.refreshPreview()
  if (!ok) return
  lastSavedCode.value = code.value
  isDocumentSaved.value = true
}

// ==================== Canvas Recording Target ====================
const containerRef = ref<HTMLElement | null>(null)

// ==================== Lifecycle ====================
onMounted(() => {
  // Set the capture target for canvas-based recording (HTTP fallback)
  recording.captureTargetRef.value = containerRef.value
  preview.refreshPreview()
  lastSavedCode.value = code.value
  isDocumentSaved.value = true
  editorScroll.textareaRef.value?.focus()
  document.addEventListener('keydown', keyboard.handleGlobalKeydown)
})

onUnmounted(() => {
  typingEngine.cleanup()
  resize.cleanup()
  recording.cleanupRecordingResources()
  document.removeEventListener('keydown', keyboard.handleGlobalKeydown)
})
</script>

<template>
  <div class="code-display-container" ref="containerRef">
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
        <!-- Manual Record Button -->
        <button
          class="record-btn"
          :class="{ recording: recording.isRecording.value }"
          @click="recording.toggleManualRecording"
          :title="recording.isRecording.value ? '停止录屏并下载' : '开始手动录屏'"
        >
          <span class="record-btn-dot" :class="{ active: recording.isRecording.value }"></span>
          <span v-if="recording.isRecording.value" class="record-btn-time">{{ recording.recordingDuration.value }}</span>
          <span>{{ recording.isRecording.value ? '停止录屏' : '录屏' }}</span>
          <span v-if="recording.isRecording.value && recording.recordingMode.value === 'canvas'" class="record-mode-badge">画布</span>
          <span v-if="recording.isRecording.value && recording.recordingMode.value === 'desktop'" class="record-mode-badge desktop">桌面</span>
        </button>

        <button class="split-btn" @click="contentSplit.openSplitModal" :disabled="!code.trim()" title="将代码拆分为 HTML / CSS / JS 三部分">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>内容分隔</span>
        </button>

        <button class="slot-config-btn" @click="slotConfig.openSlotConfigModal" :disabled="typingEngine.isTyping.value && !typingEngine.typingComplete.value" title="一键配置 HTML / CSS / JS 插槽，自定义输入顺序">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
          </svg>
          <span>插槽配置</span>
        </button>

        <button class="typing-btn" @click="openPasteModal" :disabled="typingEngine.isTyping.value && !typingEngine.typingComplete.value">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>模拟手打</span>
        </button>

        <ThemeSelector />

        <span class="lang-badge">HTML</span>
        <span class="save-status" :class="{ unsaved: !isDocumentSaved }">
          <span class="save-status-dot"></span>
          {{ isDocumentSaved ? '已保存' : '未保存' }}
        </span>
        <span class="line-count">{{ editorScroll.lineNumbers.value.length }} lines</span>
      </div>
    </header>

    <!-- Recording Error Toast -->
    <Transition name="toast">
      <div v-if="recording.recordingError.value" class="recording-error-toast">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ recording.recordingError.value }}</span>
        <button class="toast-close" @click="recording.recordingError.value = ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- Typing Error Toast -->
    <Transition name="toast">
      <div v-if="typingEngine.typingError.value" class="typing-error-toast">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ typingEngine.typingError.value }}</span>
        <button class="toast-close" @click="typingEngine.typingError.value = ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- Typing Control Bar -->
    <TypingControlBar
      v-if="typingEngine.isTyping.value || typingEngine.typingComplete.value"
      :is-typing="typingEngine.isTyping.value"
      :is-paused="typingEngine.isPaused.value"
      :typing-complete="typingEngine.typingComplete.value"
      :typing-mode="typingEngine.typingMode.value"
      :speed-preset="typingEngine.speedPreset.value"
      :typing-speed="typingEngine.typingSpeed.value"
      :manual-chars-per-key="typingEngine.manualCharsPerKey.value"
      :typing-status-text="typingEngine.typingStatusText.value"
      :typing-progress="typingEngine.typingProgress.value"
      :current-index="typingEngine.currentIndex.value"
      :target-code-length="typingEngine.targetCode.value.length"
      :is-framework-mode="typingEngine.isFrameworkMode.value"
      :framework-typed-chars="typingEngine.frameworkTypedChars.value"
      :framework-total-chars="typingEngine.frameworkTotalChars.value"
      :is-recording="recording.isRecording.value"
      :recording-duration="recording.recordingDuration.value"
      @toggle-pause="typingEngine.togglePause"
      @finish-instantly="typingEngine.finishInstantly"
      @stop-typing="typingEngine.stopTyping"
      @switch-mode="typingEngine.switchMode"
      @update:speed-preset="typingEngine.speedPreset.value = $event as SpeedPreset"
      @update:typing-speed="typingEngine.typingSpeed.value = $event"
      @update:manual-chars-per-key="typingEngine.manualCharsPerKey.value = $event"
      @stop-recording="recording.stopRecordingAndDownload"
    />

    <!-- Editor Area -->
    <div class="editor-wrapper">
      <!-- Line Numbers -->
      <div class="line-numbers" :ref="(el) => { editorScroll.lineNumbersRef.value = el as HTMLElement | null }">
        <div v-for="num in editorScroll.lineNumbers.value" :key="num" class="line-num">{{ num }}</div>
      </div>

      <!-- Code Layers -->
      <div class="code-area">
        <pre
          :ref="(el) => { editorScroll.codeDisplayRef.value = el as HTMLElement | null }"
          class="code-highlight"
        ><code v-html="preview.highlightedCode.value"></code></pre>

        <textarea
          :ref="(el) => { editorScroll.textareaRef.value = el as HTMLTextAreaElement | null }"
          v-model="code"
          class="code-input"
          @scroll="editorScroll.syncScroll"
          @keydown="editorScroll.handleTab"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          :readonly="typingEngine.isTyping.value && !typingEngine.typingComplete.value"
          placeholder="点击右上角「模拟手打」按钮，粘贴代码开始模拟打字..."
        />
      </div>
    </div>

    <!-- Preview Panel -->
    <PreviewPanel
      :preview-code="preview.previewCode.value"
      :preview-expanded="preview.previewExpanded.value"
      :preview-width="resize.previewWidth.value"
      :preview-height="resize.previewHeight.value"
      :is-resizing="resize.isResizing.value"
      :preview-mode="preview.previewMode.value"
      @toggle-preview="preview.togglePreview"
      @toggle-preview-mode="preview.togglePreviewMode"
      @resize-start="resize.onResizeStart"
    />

    <!-- Paste Modal -->
    <PasteModal
      :show="showPasteModal"
      :paste-code="pasteCode"
      :typing-mode="typingEngine.typingMode.value"
      :auto-record="recording.autoRecord.value"
      :auto-stop-record="recording.autoStopRecord.value"
      @close="closePasteModal"
      @update:paste-code="pasteCode = $event"
      @update:typing-mode="typingEngine.typingMode.value = $event"
      @update:auto-record="recording.autoRecord.value = $event"
      @update:auto-stop-record="recording.autoStopRecord.value = $event"
      @start-typing="handleStartTyping"
    />

    <!-- Split Content Modal -->
    <SplitModal
      :show="contentSplit.showSplitModal.value"
      :split-h-t-m-l="contentSplit.splitHTML.value"
      :split-c-s-s="contentSplit.splitCSS.value"
      :split-j-s="contentSplit.splitJS.value"
      :copied-section="contentSplit.copiedSection.value"
      @close="contentSplit.closeSplitModal"
      @copy-split-section="contentSplit.copySplitSection"
      @open-in-code-pen="contentSplit.openInCodePen"
    />

    <!-- Slot Config Modal -->
    <SlotConfigModal
      :show="slotConfig.showSlotConfigModal.value"
      :slot-config-input="slotConfig.slotConfigInput.value"
      :slot-config-order="slotConfig.slotConfigOrder.value"
      :slot-config-pause-between="slotConfig.slotConfigPauseBetween.value"
      :slot-config-dragging="slotConfig.slotConfigDragging.value"
      :slot-config-drag-over="slotConfig.slotConfigDragOver.value"
      :slot-config-copied="slotConfig.slotConfigCopied.value"
      :slot-config-has-parsed="slotConfig.slotConfigHasParsed.value"
      :slot-config-stats="slotConfig.slotConfigStats.value"
      :slot-config-generated="slotConfig.slotConfigGenerated.value"
      :get-slot-config-parsed="slotConfig.getSlotConfigParsed"
      @close="slotConfig.closeSlotConfigModal"
      @update:slot-config-input="slotConfig.slotConfigInput.value = $event"
      @update:slot-config-pause-between="slotConfig.slotConfigPauseBetween.value = $event"
      @drag-start="slotConfig.onSlotConfigDragStart"
      @drag-end="slotConfig.onSlotConfigDragEnd"
      @drag-enter="slotConfig.onSlotConfigDragEnter"
      @drag-leave="slotConfig.onSlotConfigDragLeave"
      @drop="slotConfig.onSlotConfigDrop"
      @move="slotConfig.moveSlotConfig"
      @copy-code="slotConfig.copySlotConfigCode"
      @use-code="slotConfig.useSlotConfigCode"
    />
  </div>
</template>

<style scoped>
.code-display-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--editor-bg);
  color: var(--editor-text);
  overflow: hidden;
  position: relative;
}

/* Header */
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--editor-surface);
  border-bottom: 1px solid var(--editor-border);
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
  color: var(--editor-accent);
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--editor-text);
  font-family: system-ui, -apple-system, sans-serif;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Record Button (Header) */
.record-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid var(--editor-border);
  background: rgba(205, 214, 244, 0.05);
  color: var(--editor-muted);
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.record-btn:hover {
  background: rgba(243, 139, 168, 0.1);
  border-color: rgba(243, 139, 168, 0.3);
  color: #f38ba8;
}

.record-btn.recording {
  background: rgba(243, 139, 168, 0.12);
  border-color: rgba(243, 139, 168, 0.4);
  color: #f38ba8;
}

.record-btn.recording:hover {
  background: rgba(243, 139, 168, 0.2);
  border-color: rgba(243, 139, 168, 0.6);
}

.record-btn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--editor-muted);
  flex-shrink: 0;
  transition: background 0.2s;
}

.record-btn:hover .record-btn-dot {
  background: #f38ba8;
}

.record-btn-dot.active {
  background: #f38ba8;
  animation: recordingPulse 1.2s ease-in-out infinite;
}

@keyframes recordingPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.record-btn-time {
  font-size: 12px;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-weight: 600;
  color: #f38ba8;
  min-width: 36px;
}

.record-mode-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(250, 179, 135, 0.2);
  color: #fab387;
  line-height: 1.2;
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

.split-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid rgba(137, 180, 250, 0.3);
  background: rgba(137, 180, 250, 0.1);
  color: #89b4fa;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.split-btn:hover:not(:disabled) {
  background: rgba(137, 180, 250, 0.2);
  border-color: rgba(137, 180, 250, 0.5);
}

.split-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slot-config-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid rgba(166, 227, 161, 0.3);
  background: rgba(166, 227, 161, 0.1);
  color: #a6e3a1;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.slot-config-btn:hover:not(:disabled) {
  background: rgba(166, 227, 161, 0.2);
  border-color: rgba(166, 227, 161, 0.5);
}

.slot-config-btn:disabled {
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
  color: var(--editor-muted);
  font-family: system-ui, sans-serif;
}

.save-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #a6e3a1;
  font-family: system-ui, sans-serif;
  padding: 3px 8px;
  border-radius: 12px;
  background: rgba(166, 227, 161, 0.14);
}

.save-status.unsaved {
  color: #f9e2af;
  background: rgba(249, 226, 175, 0.16);
}

.save-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.95;
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
  background: var(--editor-surface);
  border-right: 1px solid var(--editor-border);
  overflow: hidden;
  user-select: none;
}

.line-num {
  height: 22px;
  line-height: 22px;
  font-size: 13px;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  color: var(--editor-line-number);
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
  color: var(--editor-text);
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
  caret-color: var(--editor-cursor);
  border: none;
  outline: none;
  resize: none;
  z-index: 2;
  -webkit-text-fill-color: transparent;
}

.code-input::selection {
  background: var(--editor-selection);
  -webkit-text-fill-color: transparent;
}

.code-input::placeholder {
  -webkit-text-fill-color: var(--editor-placeholder);
  color: var(--editor-placeholder);
}

/* Typing Cursor — use :deep() because the element is injected via v-html */
.code-highlight :deep(.typing-cursor) {
  display: inline-block;
  width: 2px;
  height: 1.15em;
  background-color: var(--editor-cursor);
  animation: cursor-blink 1s steps(2) infinite;
  vertical-align: text-bottom;
  border-radius: 1px;
  box-shadow: 0 0 4px var(--editor-cursor-glow);
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
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
  background: var(--editor-scrollbar);
  border-radius: 4px;
}

.code-highlight::-webkit-scrollbar-thumb:hover,
.code-input::-webkit-scrollbar-thumb:hover {
  background: var(--editor-scrollbar-hover);
}

/* Recording Error Toast */
.recording-error-toast {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: rgba(243, 139, 168, 0.15);
  border: 1px solid rgba(243, 139, 168, 0.4);
  border-radius: 10px;
  color: #f38ba8;
  font-size: 13px;
  font-weight: 500;
  font-family: system-ui, sans-serif;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 90%;
  white-space: nowrap;
}

.recording-error-toast svg {
  flex-shrink: 0;
}

/* Typing Error Toast */
.typing-error-toast {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: rgba(250, 179, 135, 0.15);
  border: 1px solid rgba(250, 179, 135, 0.4);
  border-radius: 10px;
  color: #fab387;
  font-size: 13px;
  font-weight: 500;
  font-family: system-ui, sans-serif;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 90%;
  white-space: nowrap;
}

.typing-error-toast svg {
  flex-shrink: 0;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #f38ba8;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
}

.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

/* Responsive */
@media (max-width: 768px) {
  .line-numbers {
    width: 44px;
  }

  .line-num {
    font-size: 12px;
    padding-right: 12px;
  }
}
</style>
