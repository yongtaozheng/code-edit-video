<script setup lang="ts">
import { useFontSize } from '../../composables/useFontSize'

const { fontSize, canZoomIn, canZoomOut, zoomIn, zoomOut, resetFontSize } = useFontSize()
</script>

<template>
  <div class="font-size-control">
    <button
      class="font-size-btn"
      :disabled="!canZoomOut"
      @click="zoomOut"
      title="缩小字体 (Ctrl+-)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>

    <button
      class="font-size-label"
      @click="resetFontSize"
      title="重置字体大小"
    >
      {{ fontSize }}px
    </button>

    <button
      class="font-size-btn"
      :disabled="!canZoomIn"
      @click="zoomIn"
      title="放大字体 (Ctrl++)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.font-size-control {
  display: flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--editor-border);
  border-radius: 8px;
  background: rgba(205, 214, 244, 0.05);
  padding: 1px;
}

.font-size-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--editor-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.font-size-btn:hover:not(:disabled) {
  background: rgba(205, 214, 244, 0.12);
  color: var(--editor-text);
}

.font-size-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.font-size-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--editor-muted);
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, 'SF Mono', monospace;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0 4px;
  white-space: nowrap;
}

.font-size-label:hover {
  background: rgba(205, 214, 244, 0.08);
  color: var(--editor-text);
}
</style>
