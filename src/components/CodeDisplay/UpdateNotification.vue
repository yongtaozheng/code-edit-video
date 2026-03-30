<script setup lang="ts">
defineProps<{
  updateAvailable: boolean
  latestVersion: string
  currentVersion: string
  checking: boolean
}>()

const emit = defineEmits<{
  dismiss: []
  openRelease: []
  checkUpdate: []
}>()
</script>

<template>
  <!-- Update Available Toast -->
  <Teleport to="body">
    <Transition name="update-toast">
      <div v-if="updateAvailable" class="update-toast">
        <div class="update-toast-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>

        <div class="update-toast-body">
          <div class="update-toast-title">发现新版本</div>
          <div class="update-toast-version">
            <span class="version-current">v{{ currentVersion }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span class="version-new">v{{ latestVersion }}</span>
          </div>
        </div>

        <div class="update-toast-actions">
          <button class="update-btn-download" @click="emit('openRelease')">
            查看更新
          </button>
          <button class="update-btn-dismiss" @click="emit('dismiss')" title="忽略此版本">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(30, 30, 46, 0.95);
  border: 1px solid rgba(137, 180, 250, 0.3);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(137, 180, 250, 0.1);
  font-family: system-ui, sans-serif;
  max-width: 380px;
}

.update-toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(137, 180, 250, 0.15), rgba(203, 166, 247, 0.15));
  color: #89b4fa;
  flex-shrink: 0;
}

.update-toast-body {
  flex: 1;
  min-width: 0;
}

.update-toast-title {
  font-size: 13px;
  font-weight: 600;
  color: #cdd6f4;
  margin-bottom: 3px;
}

.update-toast-version {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.version-current {
  color: #6c7086;
}

.update-toast-version svg {
  color: #6c7086;
}

.version-new {
  color: #a6e3a1;
  font-weight: 600;
}

.update-toast-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.update-btn-download {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #89b4fa, #cba6f7);
  color: #11111b;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.update-btn-download:hover {
  filter: brightness(1.1);
  box-shadow: 0 4px 16px rgba(137, 180, 250, 0.3);
}

.update-btn-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #6c7086;
  cursor: pointer;
  transition: all 0.15s;
}

.update-btn-dismiss:hover {
  background: rgba(243, 139, 168, 0.1);
  color: #f38ba8;
}

/* Transition */
.update-toast-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.update-toast-leave-active {
  transition: all 0.25s ease-in;
}

.update-toast-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}

.update-toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
</style>
