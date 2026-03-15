<script setup lang="ts">
import '../../assets/modal-shared.css'

const inputPlaceholder = [
  '在此粘贴完整的 HTML 页面代码...',
  '',
  '例如：',
  '<!DOCTYPE html>',
  '<html>',
  '<head>',
  '  <style>',
  '    body { margin: 0; }',
  '  </style>',
  '</head>',
  '<body>',
  '  <div>Hello World</div>',
  '  <script>',
  "    console.log('hello')",
  '  </' + 'script>',
  '</body>',
  '</html>',
].join('\n')

defineProps<{
  show: boolean
  slotConfigInput: string
  slotConfigOrder: ('html' | 'css' | 'js')[]
  slotConfigPauseBetween: boolean
  slotConfigDragging: 'html' | 'css' | 'js' | null
  slotConfigDragOver: 'html' | 'css' | 'js' | null
  slotConfigCopied: boolean
  slotConfigHasParsed: boolean
  slotConfigStats: { type: string; chars: number; lines: number }[]
  slotConfigGenerated: string
  getSlotConfigParsed: (type: 'html' | 'css' | 'js') => string
}>()

const emit = defineEmits<{
  close: []
  'update:slotConfigInput': [value: string]
  'update:slotConfigPauseBetween': [value: boolean]
  dragStart: [e: DragEvent, type: 'html' | 'css' | 'js']
  dragEnd: []
  dragEnter: [type: 'html' | 'css' | 'js']
  dragLeave: [e: DragEvent, type: 'html' | 'css' | 'js']
  drop: [e: DragEvent, type: 'html' | 'css' | 'js']
  move: [type: 'html' | 'css' | 'js', direction: 'up' | 'down']
  copyCode: []
  useCode: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" v-if="show" @click.self="emit('close')">
      <div class="slot-config-modal">
        <div class="modal-header">
          <div class="modal-title-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
            <h3>插槽配置</h3>
            <span class="slot-config-subtitle">粘贴完整 HTML 页面，自动识别并添加插槽标记</span>
          </div>
          <button class="modal-close" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="slot-config-body">
          <!-- Input Area -->
          <div class="slot-config-section">
            <div class="slot-config-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              粘贴完整 HTML 页面代码
            </div>
            <textarea
              class="slot-config-input-textarea"
              :value="slotConfigInput"
              @input="emit('update:slotConfigInput', ($event.target as HTMLTextAreaElement).value)"
              :placeholder="inputPlaceholder"
              spellcheck="false"
            />
          </div>

          <!-- Parsed Sections & Order Config -->
          <div class="slot-config-section" v-if="slotConfigHasParsed">
            <div class="slot-config-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              插槽顺序
              <span class="slot-config-section-hint">拖拽或点击箭头调整输入顺序</span>
            </div>
            <div class="slot-config-order-list">
              <div
                v-for="(type, idx) in slotConfigOrder"
                :key="type"
                class="slot-config-order-item"
                :class="{
                  'slot-dragging': slotConfigDragging === type,
                  'slot-drag-over': slotConfigDragOver === type,
                  'slot-empty': !getSlotConfigParsed(type).trim(),
                }"
                draggable="true"
                @dragstart="emit('dragStart', $event, type)"
                @dragend="emit('dragEnd')"
                @dragover.prevent
                @dragenter="emit('dragEnter', type)"
                @dragleave="emit('dragLeave', $event, type)"
                @drop="emit('drop', $event, type)"
              >
                <span class="slot-drag-handle" title="拖拽调整顺序">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                  </svg>
                </span>
                <span class="slot-order-badge" v-if="getSlotConfigParsed(type).trim()">{{ idx + 1 }}</span>
                <span class="slot-order-badge slot-order-badge-empty" v-else>-</span>
                <span class="slot-config-label" :class="'slot-label-' + type">
                  <svg v-if="type === 'html'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <svg v-else-if="type === 'css'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M4 7l4.5 4.5L4 16" />
                    <line x1="12" y1="16" x2="20" y2="16" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M17 11l-5-5" />
                    <path d="M17 11H7" />
                    <path d="M7 13l5 5" />
                    <path d="M7 13h10" />
                  </svg>
                  {{ type === 'html' ? 'HTML' : type === 'css' ? 'CSS' : 'JavaScript' }}
                </span>
                <span class="slot-config-chars" v-if="getSlotConfigParsed(type).trim()">
                  {{ getSlotConfigParsed(type).length }} 字符 · {{ getSlotConfigParsed(type).split('\n').length }} 行
                </span>
                <span class="slot-config-chars slot-config-chars-empty" v-else>无内容</span>
                <div class="slot-move-btns">
                  <button class="slot-move-btn" @click.stop="emit('move', type, 'up')" :disabled="idx === 0" title="上移">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button class="slot-move-btn" @click.stop="emit('move', type, 'down')" :disabled="idx === slotConfigOrder.length - 1" title="下移">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Pause Toggle -->
            <div class="slot-config-pause-row">
              <label class="record-toggle" title="每个插槽输入完成后暂停，等待手动继续">
                <input type="checkbox" :checked="slotConfigPauseBetween" @change="emit('update:slotConfigPauseBetween', ($event.target as HTMLInputElement).checked)" class="record-toggle-input" />
                <span class="record-toggle-track">
                  <span class="record-toggle-thumb"></span>
                </span>
                <span class="record-toggle-label">分段暂停（每个插槽输入完成后暂停）</span>
              </label>
            </div>
          </div>

          <!-- Generated Code Preview -->
          <div class="slot-config-section" v-if="slotConfigGenerated">
            <div class="slot-config-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              生成预览
              <span class="slot-config-section-hint">已在代码中插入 [slot] 标记</span>
            </div>
            <div class="slot-config-preview-wrapper">
              <pre class="slot-config-preview">{{ slotConfigGenerated }}</pre>
            </div>
          </div>
        </div>

        <div class="slot-config-footer">
          <div class="slot-config-footer-left">
            <div class="slot-config-stats" v-if="slotConfigHasParsed">
              <span
                v-for="stat in slotConfigStats"
                :key="stat.type"
                class="slot-stat"
                :class="'slot-stat-' + stat.type.toLowerCase()"
              >
                {{ stat.type }} {{ stat.chars }} 字符
              </span>
            </div>
            <div class="slot-config-order-preview" v-if="slotConfigHasParsed">
              <span class="slot-order-label">输入顺序：</span>
              <span
                v-for="(type, idx) in slotConfigOrder.filter(t => getSlotConfigParsed(t).trim())"
                :key="type"
                class="slot-order-item"
                :class="'slot-order-' + type"
              >
                {{ idx > 0 ? ' → ' : '' }}{{ type.toUpperCase() }}
              </span>
            </div>
          </div>
          <div class="slot-config-footer-right">
            <button class="modal-btn modal-btn-cancel" @click="emit('close')">关闭</button>
            <button
              class="modal-btn slot-btn-copy"
              :class="{ copied: slotConfigCopied }"
              @click="emit('copyCode')"
              :disabled="!slotConfigGenerated"
            >
              <svg v-if="!slotConfigCopied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ slotConfigCopied ? '已复制' : '复制代码' }}
            </button>
            <button
              class="modal-btn modal-btn-start"
              @click="emit('useCode')"
              :disabled="!slotConfigGenerated"
              title="将生成的代码填入模拟手打"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              使用此代码
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.slot-config-modal {
  width: 780px;
  max-width: 95vw;
  max-height: 90vh;
  background: var(--editor-bg);
  border: 1px solid var(--editor-border);
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slot-config-subtitle { font-size: 12px; font-weight: 400; color: var(--editor-muted); margin-left: 4px; }
.slot-config-body { flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 16px 20px; overflow-y: auto; min-height: 0; }
.slot-config-section { display: flex; flex-direction: column; gap: 8px; }
.slot-config-section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--editor-text); font-family: system-ui, sans-serif; }
.slot-config-section-hint { font-size: 11px; font-weight: 400; color: var(--editor-muted); margin-left: 4px; }
.slot-config-input-textarea { width: 100%; height: 200px; background: var(--editor-surface-deep); border: 1px solid var(--editor-border); border-radius: 10px; padding: 14px 16px; color: var(--editor-text); font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace; font-size: 13px; line-height: 20px; resize: vertical; outline: none; tab-size: 2; white-space: pre; overflow: auto; transition: border-color 0.2s; box-sizing: border-box; }
.slot-config-input-textarea:focus { border-color: var(--editor-accent); }
.slot-config-input-textarea::placeholder { color: var(--editor-placeholder); }
.slot-config-order-list { display: flex; flex-direction: column; gap: 4px; }
.slot-config-order-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--editor-border); border-radius: 8px; background: var(--editor-surface); cursor: grab; user-select: none; transition: all 0.2s; }
.slot-config-order-item:active { cursor: grabbing; }
.slot-config-order-item.slot-dragging { opacity: 0.4; transform: scale(0.97); }
.slot-config-order-item.slot-drag-over { border-color: rgba(166, 227, 161, 0.5); box-shadow: 0 0 0 2px rgba(166, 227, 161, 0.12); }
.slot-config-order-item.slot-empty { opacity: 0.4; }
.slot-drag-handle { display: flex; align-items: center; color: var(--editor-placeholder); cursor: grab; transition: color 0.2s; flex-shrink: 0; }
.slot-drag-handle:hover { color: var(--editor-text); }
.slot-order-badge { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: rgba(203, 166, 247, 0.15); color: var(--editor-accent); font-size: 11px; font-weight: 700; font-family: ui-monospace, 'SF Mono', monospace; flex-shrink: 0; }
.slot-order-badge-empty { background: rgba(108, 112, 134, 0.1); color: var(--editor-muted); }
.slot-config-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; font-family: system-ui, sans-serif; min-width: 90px; }
.slot-label-html { color: #fab387; }
.slot-label-css  { color: #89b4fa; }
.slot-label-js   { color: #f9e2af; }
.slot-config-chars { font-size: 11px; color: var(--editor-muted); font-family: system-ui, sans-serif; flex: 1; }
.slot-config-chars-empty { color: var(--editor-placeholder); font-style: italic; }
.slot-move-btns { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.slot-move-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--editor-muted); cursor: pointer; transition: all 0.15s; }
.slot-move-btn:hover:not(:disabled) { background: rgba(205, 214, 244, 0.08); border-color: var(--editor-border); color: var(--editor-text); }
.slot-move-btn:disabled { opacity: 0.2; cursor: not-allowed; }
.slot-config-pause-row { padding-top: 4px; }
.slot-config-preview-wrapper { border: 1px solid var(--editor-border); border-radius: 10px; background: var(--editor-surface-deep); overflow: hidden; max-height: 200px; overflow-y: auto; }
.slot-config-preview { margin: 0; padding: 14px 16px; font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace; font-size: 12px; line-height: 19px; color: var(--editor-text); white-space: pre; tab-size: 2; word-break: break-all; overflow-wrap: break-word; }
.slot-config-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid var(--editor-border); gap: 12px; }
.slot-config-footer-left { display: flex; flex-direction: column; gap: 4px; }
.slot-config-footer-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.slot-config-stats { display: flex; align-items: center; gap: 8px; }
.slot-stat { font-size: 11px; font-weight: 600; font-family: system-ui, sans-serif; padding: 2px 8px; border-radius: 4px; }
.slot-stat-html { background: rgba(250, 179, 135, 0.1); color: #fab387; }
.slot-stat-css { background: rgba(137, 180, 250, 0.1); color: #89b4fa; }
.slot-stat-js { background: rgba(249, 226, 175, 0.1); color: #f9e2af; }
.slot-config-order-preview { display: flex; align-items: center; font-size: 11px; font-family: system-ui, sans-serif; }
.slot-order-label { color: var(--editor-muted); margin-right: 4px; }
.slot-order-item { font-weight: 600; }
.slot-order-html { color: #fab387; }
.slot-order-css  { color: #89b4fa; }
.slot-order-js   { color: #f9e2af; }
.slot-btn-copy { background: rgba(166, 227, 161, 0.1); border-color: rgba(166, 227, 161, 0.3); color: #a6e3a1; }
.slot-btn-copy:hover:not(:disabled) { background: rgba(166, 227, 161, 0.2); border-color: rgba(166, 227, 161, 0.5); }
.slot-btn-copy.copied { background: rgba(166, 227, 161, 0.15); color: #a6e3a1; }
.slot-config-input-textarea::-webkit-scrollbar, .slot-config-preview-wrapper::-webkit-scrollbar { width: 5px; height: 5px; }
.slot-config-input-textarea::-webkit-scrollbar-track, .slot-config-preview-wrapper::-webkit-scrollbar-track { background: transparent; }
.slot-config-input-textarea::-webkit-scrollbar-thumb, .slot-config-preview-wrapper::-webkit-scrollbar-thumb { background: var(--editor-border); border-radius: 3px; }
.slot-config-input-textarea::-webkit-scrollbar-thumb:hover, .slot-config-preview-wrapper::-webkit-scrollbar-thumb:hover { background: var(--editor-scrollbar-hover); }
.slot-config-body::-webkit-scrollbar { width: 5px; }
.slot-config-body::-webkit-scrollbar-track { background: transparent; }
.slot-config-body::-webkit-scrollbar-thumb { background: var(--editor-border); border-radius: 3px; }

@media (max-width: 768px) {
  .slot-config-modal { width: 95vw; max-height: 90vh; }
  .slot-config-subtitle, .slot-config-section-hint { display: none; }
  .slot-config-footer { flex-direction: column; gap: 10px; }
  .slot-config-footer-right { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
  .slot-config-input-textarea { height: 150px; }
  .slot-config-preview-wrapper { max-height: 150px; }
}
</style>
