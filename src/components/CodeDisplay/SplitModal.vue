<script setup lang="ts">
import '../../assets/modal-shared.css'

defineProps<{
  show: boolean
  splitHTML: string
  splitCSS: string
  splitJS: string
  copiedSection: 'html' | 'css' | 'js' | ''
}>()

const emit = defineEmits<{
  close: []
  copySplitSection: [section: 'html' | 'css' | 'js']
  openInCodePen: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" v-if="show" @click.self="emit('close')">
      <div class="split-modal-content">
        <div class="modal-header">
          <div class="modal-title-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <h3>内容分隔</h3>
            <span class="split-subtitle">拆分为 HTML / CSS / JS，可直接复制到 CodePen</span>
          </div>
          <button class="modal-close" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="split-panels">
          <!-- HTML Panel -->
          <div class="split-panel">
            <div class="split-panel-header">
              <span class="split-panel-label split-label-html">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                HTML
              </span>
              <span class="split-panel-lines" v-if="splitHTML">{{ splitHTML.split('\n').length }} 行</span>
              <button
                class="split-copy-btn"
                :class="{ copied: copiedSection === 'html' }"
                @click="emit('copySplitSection', 'html')"
                :disabled="!splitHTML"
              >
                <svg v-if="copiedSection !== 'html'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ copiedSection === 'html' ? '已复制' : '复制' }}
              </button>
            </div>
            <div class="split-panel-code">
              <pre v-if="splitHTML">{{ splitHTML }}</pre>
              <div v-else class="split-empty">无 HTML 内容</div>
            </div>
          </div>

          <!-- CSS Panel -->
          <div class="split-panel">
            <div class="split-panel-header">
              <span class="split-panel-label split-label-css">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M4 7l4.5 4.5L4 16" />
                  <line x1="12" y1="16" x2="20" y2="16" />
                </svg>
                CSS
              </span>
              <span class="split-panel-lines" v-if="splitCSS">{{ splitCSS.split('\n').length }} 行</span>
              <button
                class="split-copy-btn"
                :class="{ copied: copiedSection === 'css' }"
                @click="emit('copySplitSection', 'css')"
                :disabled="!splitCSS"
              >
                <svg v-if="copiedSection !== 'css'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ copiedSection === 'css' ? '已复制' : '复制' }}
              </button>
            </div>
            <div class="split-panel-code">
              <pre v-if="splitCSS">{{ splitCSS }}</pre>
              <div v-else class="split-empty">无 CSS 内容</div>
            </div>
          </div>

          <!-- JS Panel -->
          <div class="split-panel">
            <div class="split-panel-header">
              <span class="split-panel-label split-label-js">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M17 11l-5-5" />
                  <path d="M17 11H7" />
                  <path d="M7 13l5 5" />
                  <path d="M7 13h10" />
                </svg>
                JS
              </span>
              <span class="split-panel-lines" v-if="splitJS">{{ splitJS.split('\n').length }} 行</span>
              <button
                class="split-copy-btn"
                :class="{ copied: copiedSection === 'js' }"
                @click="emit('copySplitSection', 'js')"
                :disabled="!splitJS"
              >
                <svg v-if="copiedSection !== 'js'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ copiedSection === 'js' ? '已复制' : '复制' }}
              </button>
            </div>
            <div class="split-panel-code">
              <pre v-if="splitJS">{{ splitJS }}</pre>
              <div v-else class="split-empty">无 JS 内容</div>
            </div>
          </div>
        </div>

        <div class="split-modal-footer">
          <div class="split-footer-left">
            <span class="split-stats">
              <span v-if="splitHTML" class="split-stat split-stat-html">HTML {{ splitHTML.length }} 字符</span>
              <span v-if="splitCSS" class="split-stat split-stat-css">CSS {{ splitCSS.length }} 字符</span>
              <span v-if="splitJS" class="split-stat split-stat-js">JS {{ splitJS.length }} 字符</span>
            </span>
          </div>
          <div class="split-footer-right">
            <button class="modal-btn modal-btn-cancel" @click="emit('close')">关闭</button>
            <button class="modal-btn split-btn-codepen" @click="emit('openInCodePen')" title="在 CodePen 中打开">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M18.144 13.067v-2.134L16.55 12zm1.856 1.018V9.915a.636.636 0 0 0-.318-.55L12.317.315a.636.636 0 0 0-.635 0L4.317 5.365a.636.636 0 0 0-.317.55v8.17a.636.636 0 0 0 .317.55l7.365 5.05a.636.636 0 0 0 .635 0l7.365-5.05a.636.636 0 0 0 .318-.55zM12 14.52l-2.26-1.517L12 11.49l2.26 1.513zm-.635-6.71v-3.36L6.5 7.75l2.227 1.495zm1.27 0l3.365-2.3L6.5 7.75 8.727 9.245zm-6.405 3.173l-1.595 1.07V10.913zM5.856 13.067l3.59-2.41L12 12.174l-2.555 1.715zm1.273 1.498l3.506 2.353v-3.36zm5.506 2.353l3.506-2.353-3.506-2.362v4.715zm1.273-5.508l3.59 2.41 1.594-1.07z"/>
              </svg>
              在 CodePen 中打开
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.split-modal-content {
  width: 960px;
  max-width: 95vw;
  max-height: 85vh;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.split-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #6c7086;
  margin-left: 4px;
}

.split-panels {
  flex: 1;
  display: flex;
  gap: 1px;
  background: #313244;
  overflow: hidden;
  min-height: 0;
}

.split-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
  min-width: 0;
  overflow: hidden;
}

.split-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #181825;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
  gap: 8px;
}

.split-panel-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
}

.split-label-html { color: #fab387; }
.split-label-css  { color: #89b4fa; }
.split-label-js   { color: #f9e2af; }

.split-panel-lines {
  font-size: 11px;
  color: #585b70;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
}

.split-copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #313244;
  background: rgba(205, 214, 244, 0.05);
  color: #6c7086;
  font-size: 11px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.split-copy-btn:hover:not(:disabled) {
  background: rgba(205, 214, 244, 0.12);
  border-color: #45475a;
  color: #cdd6f4;
}

.split-copy-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.split-copy-btn.copied {
  background: rgba(166, 227, 161, 0.12);
  border-color: rgba(166, 227, 161, 0.3);
  color: #a6e3a1;
}

.split-panel-code {
  flex: 1;
  overflow: auto;
  padding: 14px;
  min-height: 200px;
  max-height: 50vh;
}

.split-panel-code pre {
  margin: 0;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  color: #cdd6f4;
  white-space: pre;
  tab-size: 2;
  word-break: break-all;
  overflow-wrap: break-word;
}

.split-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 120px;
  color: #45475a;
  font-size: 13px;
  font-family: system-ui, sans-serif;
}

.split-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-top: 1px solid #313244;
  gap: 12px;
}

.split-footer-left {
  display: flex;
  align-items: center;
}

.split-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.split-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.split-stat {
  font-size: 11px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  padding: 2px 8px;
  border-radius: 4px;
}

.split-stat-html { background: rgba(250, 179, 135, 0.1); color: #fab387; }
.split-stat-css  { background: rgba(137, 180, 250, 0.1); color: #89b4fa; }
.split-stat-js   { background: rgba(249, 226, 175, 0.1); color: #f9e2af; }

.split-btn-codepen {
  background: linear-gradient(135deg, #a6e3a1, #89b4fa);
  color: #11111b;
  font-weight: 700;
}

.split-btn-codepen:hover {
  filter: brightness(1.1);
  box-shadow: 0 4px 16px rgba(166, 227, 161, 0.3);
}

.split-panel-code::-webkit-scrollbar { width: 5px; height: 5px; }
.split-panel-code::-webkit-scrollbar-track { background: transparent; }
.split-panel-code::-webkit-scrollbar-thumb { background: #313244; border-radius: 3px; }
.split-panel-code::-webkit-scrollbar-thumb:hover { background: #45475a; }

@media (max-width: 768px) {
  .split-modal-content { width: 95vw; max-height: 90vh; }
  .split-panels { flex-direction: column; }
  .split-panel-code { min-height: 120px; max-height: 30vh; }
  .split-modal-footer { flex-direction: column; gap: 10px; }
  .split-footer-right { width: 100%; justify-content: flex-end; }
  .split-subtitle { display: none; }
}
</style>
