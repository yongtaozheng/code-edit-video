<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { TypingMode } from '../../types'
import '../../assets/modal-shared.css'

const pasteTextareaPlaceholder = [
  '在此粘贴代码...',
  '',
  '支持行尾添加特殊标记控制输入行为：',
  '  <!--[pause]-->  在此行暂停，等待手动继续',
  '  /*[pause]*/    CSS 注释风格',
  '  //[pause]      JS 注释风格',
  '  同理支持 [quick]（瞬间输入）、[save]（主动保存）和 [ignore]（跳过）',
  '',
  '框架模式 — 先展示骨架，再逐段输入：',
  '  <!--[slot]-->          默认顺序',
  '  /*[slot:2]*/           指定输入顺序',
  '  //[slot:nopause]       输入完不暂停',
  '  <!--[slot:1:nopause]--> 组合使用',
  '  <!--[/slot]-->         片段结束',
  '',
  '注释中间允许空格：',
  '  <!--  [slot]  -->   /*  [slot]  */   //  [slot]',
].join('\n')

const props = defineProps<{
  show: boolean
  pasteCode: string
  typingMode: TypingMode
  autoRecord: boolean
  autoStopRecord: boolean
  autoExpandPreviewOnComplete: boolean
  autoStopDelaySeconds: number
}>()

const emit = defineEmits<{
  close: []
  'update:pasteCode': [value: string]
  'update:typingMode': [mode: TypingMode]
  'update:autoRecord': [value: boolean]
  'update:autoStopRecord': [value: boolean]
  'update:autoExpandPreviewOnComplete': [value: boolean]
  'update:autoStopDelaySeconds': [value: number]
  startTyping: []
}>()

const pasteTextareaRef = ref<HTMLTextAreaElement | null>(null)

watch(() => props.show, (visible) => {
  if (visible) {
    nextTick(() => {
      pasteTextareaRef.value?.focus()
    })
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" v-if="show" @click.self="emit('close')">
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <h3>粘贴要模拟输入的代码</h3>
          </div>
          <button class="modal-close" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <textarea
            ref="pasteTextareaRef"
            :value="pasteCode"
            @input="emit('update:pasteCode', ($event.target as HTMLTextAreaElement).value)"
            class="paste-textarea"
            :placeholder="pasteTextareaPlaceholder"
            spellcheck="false"
          />
          <!-- Action markers help -->
          <div class="action-help">
            <div class="action-help-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              行标记指令
            </div>
            <div class="action-help-items">
              <span class="action-tag tag-pause">&lt;!--[pause]--&gt;</span>
              <span class="action-desc">暂停输入</span>
              <span class="action-tag tag-quick">&lt;!--[quick]--&gt;</span>
              <span class="action-desc">瞬间输入整行</span>
              <span class="action-tag tag-save">&lt;!--[save]--&gt;</span>
              <span class="action-desc">该行输入完后主动保存</span>
              <span class="action-tag tag-ignore">&lt;!--[ignore]--&gt;</span>
              <span class="action-desc">跳过此行</span>
            </div>
            <div class="action-help-divider"></div>
            <div class="action-help-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              框架模式
            </div>
            <div class="action-help-items">
              <span class="action-tag tag-slot">&lt;!--[slot]--&gt;</span>
              <span class="action-desc">代码片段起始（默认顺序）</span>
              <span class="action-tag tag-slot">&lt;!--[slot:2]--&gt;</span>
              <span class="action-desc">指定输入顺序（数字越小越先）</span>
              <span class="action-tag tag-slot-nopause">&lt;!--[slot:nopause]--&gt;</span>
              <span class="action-desc">输入完不暂停，直接下一段</span>
              <span class="action-tag tag-slot">&lt;!--[/slot]--&gt;</span>
              <span class="action-desc">代码片段结束</span>
            </div>
            <div class="action-help-note">
              框架（slot 外的代码）立即显示，片段（slot 内的代码）按顺序逐字输入
            </div>
            <div class="action-help-note">
              支持 &lt;!-- --&gt;、/* */、//、# 注释风格，注释与标记之间允许空格
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="modal-footer-left">
            <span class="char-count" v-if="pasteCode">
              {{ pasteCode.length }} 字符 · {{ pasteCode.split('\n').length }} 行
            </span>
          </div>
          <div class="modal-footer-right">
            <!-- Auto-record toggles -->
            <div class="record-toggles">
              <label class="record-toggle" title="模拟开始时自动录屏">
                <input type="checkbox" :checked="autoRecord" @change="emit('update:autoRecord', ($event.target as HTMLInputElement).checked)" class="record-toggle-input" />
                <span class="record-toggle-track">
                  <span class="record-toggle-thumb"></span>
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="record-toggle-icon">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                </svg>
                <span class="record-toggle-label">自动录屏</span>
              </label>
              <label
                v-if="autoRecord"
                class="record-toggle record-toggle-sub"
                title="模拟完成后自动停止录屏并下载；关闭则模拟完成后继续录制，需手动停止"
              >
                <input type="checkbox" :checked="autoStopRecord" @change="emit('update:autoStopRecord', ($event.target as HTMLInputElement).checked)" class="record-toggle-input" />
                <span class="record-toggle-track">
                  <span class="record-toggle-thumb"></span>
                </span>
                <span class="record-toggle-label">完成自动停录</span>
              </label>
              <label
                v-if="autoRecord && autoStopRecord"
                class="record-toggle record-toggle-sub"
                title="手打完成后自动放大预览窗口，停留一段时间后再停止录屏"
              >
                <input
                  type="checkbox"
                  :checked="autoExpandPreviewOnComplete"
                  @change="emit('update:autoExpandPreviewOnComplete', ($event.target as HTMLInputElement).checked)"
                  class="record-toggle-input"
                />
                <span class="record-toggle-track">
                  <span class="record-toggle-thumb"></span>
                </span>
                <span class="record-toggle-label">完成放大预览</span>
              </label>
              <label
                v-if="autoRecord && autoStopRecord"
                class="stop-delay-control"
                title="手打完成后，停留指定秒数再自动停止录屏"
              >
                <span class="stop-delay-label">停留秒数</span>
                <input
                  type="number"
                  min="0"
                  max="600"
                  step="1"
                  :value="autoStopDelaySeconds"
                  @change="emit('update:autoStopDelaySeconds', Math.max(0, Math.min(600, Math.floor(Number(($event.target as HTMLInputElement).value) || 0))))"
                  class="stop-delay-input"
                />
                <span class="stop-delay-unit">s</span>
              </label>
            </div>

            <!-- Mode selection in modal -->
            <div class="modal-mode-toggle">
              <button
                class="modal-mode-btn"
                :class="{ active: typingMode === 'auto' }"
                @click="emit('update:typingMode', 'auto')"
              >
                自动模式
              </button>
              <button
                class="modal-mode-btn"
                :class="{ active: typingMode === 'manual' }"
                @click="emit('update:typingMode', 'manual')"
              >
                手动模式
              </button>
            </div>
            <button class="modal-btn modal-btn-cancel" @click="emit('close')">取消</button>
            <button
              class="modal-btn modal-btn-start"
              @click="emit('startTyping')"
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
</template>

<style scoped>
.modal-content {
  width: 720px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--editor-bg);
  border: 1px solid var(--editor-border);
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-body {
  flex: 1;
  padding: 16px 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.paste-textarea {
  width: 100%;
  height: 280px;
  background: var(--editor-surface-deep);
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  padding: 16px;
  color: var(--editor-text);
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 20px;
  resize: none;
  outline: none;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.paste-textarea:focus {
  border-color: var(--editor-accent);
}

.paste-textarea::placeholder {
  color: var(--editor-placeholder);
}

.action-help {
  padding: 10px 14px;
  background: rgba(203, 166, 247, 0.04);
  border: 1px solid rgba(203, 166, 247, 0.1);
  border-radius: 8px;
}

.action-help-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #a6adc8;
  font-family: system-ui, sans-serif;
  margin-bottom: 8px;
}

.action-help-items {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  align-items: center;
}

.action-tag {
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', monospace;
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-pause { background: rgba(249, 226, 175, 0.1); color: #f9e2af; }
.tag-quick { background: rgba(166, 227, 161, 0.1); color: #a6e3a1; }
.tag-save { background: rgba(250, 179, 135, 0.12); color: #fab387; }
.tag-ignore { background: rgba(108, 112, 134, 0.15); color: #6c7086; }
.tag-slot { background: rgba(137, 180, 250, 0.1); color: #89b4fa; }
.tag-slot-nopause { background: rgba(148, 226, 213, 0.1); color: #94e2d5; }

.action-help-divider { height: 1px; background: rgba(203, 166, 247, 0.08); margin: 8px 0; }

.action-help-note {
  font-size: 11px;
  color: #585b70;
  font-family: system-ui, sans-serif;
  margin-top: 4px;
  line-height: 1.4;
}

.action-desc {
  font-size: 12px;
  color: var(--editor-muted);
  font-family: system-ui, sans-serif;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--editor-border);
  gap: 12px;
}

.modal-footer-left {
  display: flex;
  align-items: center;
}

.char-count {
  font-size: 12px;
  color: var(--editor-muted);
  font-family: system-ui, sans-serif;
}

.modal-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-mode-toggle {
  display: flex;
  border-radius: 8px;
  border: 1px solid var(--editor-border);
  overflow: hidden;
}

.modal-mode-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  border: none;
  background: transparent;
  color: var(--editor-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.modal-mode-btn:first-child {
  border-right: 1px solid var(--editor-border);
}

.modal-mode-btn.active {
  background: rgba(203, 166, 247, 0.12);
  color: var(--editor-accent);
}

.modal-mode-btn:hover:not(.active) {
  background: rgba(205, 214, 244, 0.05);
}

.record-toggles {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stop-delay-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px dashed var(--editor-border);
  background: rgba(205, 214, 244, 0.03);
}

.stop-delay-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--editor-muted);
  font-family: system-ui, sans-serif;
}

.stop-delay-input {
  width: 64px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--editor-border);
  background: var(--editor-surface-deep);
  color: var(--editor-text);
  font-size: 12px;
  text-align: center;
  outline: none;
}

.stop-delay-input:focus {
  border-color: var(--editor-accent);
}

.stop-delay-unit {
  font-size: 12px;
  color: var(--editor-muted);
  font-family: ui-monospace, 'SF Mono', monospace;
}

.paste-textarea::-webkit-scrollbar { width: 6px; }
.paste-textarea::-webkit-scrollbar-track { background: transparent; }
.paste-textarea::-webkit-scrollbar-thumb { background: var(--editor-border); border-radius: 3px; }

@media (max-width: 768px) {
  .modal-content { width: 95vw; max-height: 90vh; }
  .paste-textarea { height: 200px; }
  .action-help-items { grid-template-columns: 1fr; }
}
</style>
