<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../../composables/useTheme'

const { themes, currentThemeId, currentTheme, setTheme } = useTheme()
const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function toggle() {
  isOpen.value = !isOpen.value
}

function selectTheme(id: string) {
  setTheme(id)
  isOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside, true))
onUnmounted(() => document.removeEventListener('click', handleClickOutside, true))
</script>

<template>
  <div class="theme-selector" ref="dropdownRef">
    <button class="theme-btn" @click.stop="toggle" title="切换代码主题">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
        <circle cx="12" cy="12" r="10" />
        <circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="9" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="9" cy="13" r="1.5" fill="currentColor" stroke="none" />
      </svg>
      <span class="theme-btn-label">{{ currentTheme.label }}</span>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="theme-dropdown">
        <div class="theme-dropdown-title">选择主题</div>
        <button
          v-for="theme in themes"
          :key="theme.id"
          class="theme-option"
          :class="{ active: currentThemeId === theme.id }"
          @click="selectTheme(theme.id)"
        >
          <span
            class="theme-swatch"
            :style="{
              background: theme.editor.background,
              borderColor: theme.editor.borderColor,
            }"
          ></span>
          <span class="theme-option-label">{{ theme.label }}</span>
          <span class="theme-mode-badge" :class="theme.mode">
            {{ theme.mode === 'dark' ? '暗' : '亮' }}
          </span>
          <svg
            v-if="currentThemeId === theme.id"
            class="theme-check"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            width="14"
            height="14"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.theme-selector {
  position: relative;
}

.theme-btn {
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
  white-space: nowrap;
}

.theme-btn:hover {
  background: rgba(205, 214, 244, 0.12);
  color: var(--editor-text);
  border-color: var(--editor-scrollbar-hover);
}

.theme-btn-label {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Dropdown */
.theme-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  max-height: 400px;
  overflow-y: auto;
  background: var(--editor-surface);
  border: 1px solid var(--editor-border);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  z-index: 200;
  padding: 6px;
}

.theme-dropdown-title {
  padding: 6px 10px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--editor-muted);
  font-family: system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--editor-text);
  font-size: 13px;
  font-weight: 500;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.theme-option:hover {
  background: rgba(205, 214, 244, 0.08);
}

.theme-option.active {
  background: rgba(205, 214, 244, 0.1);
}

.theme-swatch {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid;
  flex-shrink: 0;
}

.theme-option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-mode-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  line-height: 1.3;
  flex-shrink: 0;
}

.theme-mode-badge.dark {
  background: rgba(108, 112, 134, 0.15);
  color: var(--editor-muted);
}

.theme-mode-badge.light {
  background: rgba(249, 226, 175, 0.15);
  color: #f9e2af;
}

.theme-check {
  color: var(--editor-accent);
  flex-shrink: 0;
}

/* Dropdown scrollbar */
.theme-dropdown::-webkit-scrollbar {
  width: 5px;
}

.theme-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.theme-dropdown::-webkit-scrollbar-thumb {
  background: var(--editor-scrollbar);
  border-radius: 3px;
}

/* Transitions */
.dropdown-enter-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-leave-active {
  transition: all 0.15s ease-in;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
