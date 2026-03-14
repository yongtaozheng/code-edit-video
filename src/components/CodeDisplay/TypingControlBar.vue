<script setup lang="ts">
import type { TypingMode, SpeedPreset } from '../../types'

defineProps<{
  isTyping: boolean
  isPaused: boolean
  typingComplete: boolean
  typingMode: TypingMode
  speedPreset: SpeedPreset
  typingSpeed: number
  manualCharsPerKey: number
  typingStatusText: string
  typingProgress: number
  currentIndex: number
  targetCodeLength: number
  isFrameworkMode: boolean
  frameworkTypedChars: number
  frameworkTotalChars: number
  isRecording: boolean
  recordingDuration: string
}>()

const emit = defineEmits<{
  togglePause: []
  finishInstantly: []
  stopTyping: []
  switchMode: [mode: TypingMode]
  'update:speedPreset': [preset: SpeedPreset]
  'update:typingSpeed': [speed: number]
  'update:manualCharsPerKey': [n: number]
  stopRecording: []
}>()
</script>

<template>
  <div class="typing-control-bar">
    <div class="control-left">
      <!-- Play/Pause (auto mode only) -->
      <button
        v-if="!typingComplete && typingMode === 'auto'"
        class="ctrl-btn"
        @click="emit('togglePause')"
        :title="isPaused ? '继续 (Space)' : '暂停 (Space)'"
      >
        <svg v-if="!isPaused" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </button>
      <!-- Skip to end -->
      <button v-if="!typingComplete" class="ctrl-btn" @click="emit('finishInstantly')" title="立即完成">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <polygon points="5 3 19 12 5 21 5 3" />
          <rect x="18" y="3" width="3" height="18" rx="1" />
        </svg>
      </button>
      <!-- Stop -->
      <button class="ctrl-btn ctrl-btn-stop" @click="emit('stopTyping')" title="停止并清除">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>

      <span class="typing-status" :class="{
        'status-complete': typingComplete,
        'status-paused': isPaused,
        'status-manual': typingMode === 'manual' && isTyping && !typingComplete
      }">
        {{ typingStatusText }}
      </span>
    </div>

    <div class="control-center" v-if="!typingComplete">
      <!-- Mode Toggle -->
      <div class="mode-toggle">
        <button
          class="mode-btn"
          :class="{ active: typingMode === 'auto' }"
          @click="emit('switchMode', 'auto')"
          title="自动模式：自动逐字输入"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          自动
        </button>
        <button
          class="mode-btn"
          :class="{ active: typingMode === 'manual' }"
          @click="emit('switchMode', 'manual')"
          title="手动模式：按任意键触发输入"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
          </svg>
          手动
        </button>
      </div>

      <!-- Speed presets (auto mode only) -->
      <div class="speed-presets" v-if="typingMode === 'auto'">
        <span class="speed-label">速度</span>
        <button
          v-for="preset in (['slow', 'medium', 'fast'] as const)"
          :key="preset"
          class="speed-preset-btn"
          :class="{ active: speedPreset === preset }"
          @click="emit('update:speedPreset', preset)"
        >
          {{ preset === 'slow' ? '慢' : preset === 'medium' ? '中' : '快' }}
        </button>
        <input
          type="range"
          min="5"
          max="250"
          :value="250 - typingSpeed"
          @input="emit('update:typingSpeed', 250 - Number(($event.target as HTMLInputElement).value))"
          class="speed-slider"
          title="微调速度"
        />
      </div>

      <!-- Manual mode: chars per key -->
      <div class="manual-config" v-if="typingMode === 'manual'">
        <span class="speed-label">每次输入</span>
        <button
          v-for="n in [1, 3, 5, 10]"
          :key="n"
          class="speed-preset-btn"
          :class="{ active: manualCharsPerKey === n }"
          @click="emit('update:manualCharsPerKey', n)"
        >
          {{ n }}字
        </button>
      </div>
    </div>

    <div class="control-right">
      <!-- Recording Indicator -->
      <div class="recording-indicator" v-if="isRecording">
        <span class="recording-dot"></span>
        <span class="recording-time">{{ recordingDuration }}</span>
        <button class="ctrl-btn ctrl-btn-rec-stop" @click="emit('stopRecording')" title="停止录屏并下载">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      </div>

      <div class="progress-info">
        <span class="progress-text" v-if="isFrameworkMode">
          {{ frameworkTypedChars }} / {{ frameworkTotalChars }}
        </span>
        <span class="progress-text" v-else>{{ currentIndex }} / {{ targetCodeLength }}</span>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: typingProgress + '%' }"></div>
        </div>
        <span class="progress-percent">{{ typingProgress }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  flex-shrink: 0;
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
  white-space: nowrap;
}

.typing-status.status-paused { color: #f9e2af; }
.typing-status.status-complete { color: #89b4fa; }
.typing-status.status-manual { color: #f5c2e7; }

.control-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.mode-toggle {
  display: flex;
  border-radius: 8px;
  border: 1px solid #313244;
  overflow: hidden;
  flex-shrink: 0;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  border: none;
  background: transparent;
  color: #6c7086;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:first-child { border-right: 1px solid #313244; }
.mode-btn.active { background: rgba(203, 166, 247, 0.15); color: #cba6f7; }
.mode-btn:hover:not(.active) { background: rgba(205, 214, 244, 0.05); color: #a6adc8; }

.speed-presets,
.manual-config {
  display: flex;
  align-items: center;
  gap: 6px;
}

.speed-label {
  font-size: 12px;
  color: #6c7086;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
}

.speed-preset-btn {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  border: 1px solid #313244;
  border-radius: 6px;
  background: transparent;
  color: #6c7086;
  cursor: pointer;
  transition: all 0.15s;
}

.speed-preset-btn.active {
  background: rgba(166, 227, 161, 0.12);
  border-color: rgba(166, 227, 161, 0.3);
  color: #a6e3a1;
}

.speed-preset-btn:hover:not(.active) { background: rgba(205, 214, 244, 0.05); color: #a6adc8; }

.speed-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #313244;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  margin-left: 4px;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #cba6f7;
  cursor: pointer;
  border: 2px solid #1e1e2e;
}

.speed-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #cba6f7;
  cursor: pointer;
  border: 2px solid #1e1e2e;
}

.control-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(243, 139, 168, 0.08);
  border: 1px solid rgba(243, 139, 168, 0.2);
  margin-right: 12px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f38ba8;
  animation: recordingPulse 1.2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes recordingPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.recording-time {
  font-size: 12px;
  font-weight: 600;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: #f38ba8;
  min-width: 40px;
}

.ctrl-btn-rec-stop {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: #f38ba8;
  border-color: rgba(243, 139, 168, 0.3);
}

.ctrl-btn-rec-stop:hover {
  background: rgba(243, 139, 168, 0.15);
  border-color: rgba(243, 139, 168, 0.5);
}

.progress-info { display: flex; align-items: center; gap: 10px; }
.progress-text { font-size: 11px; color: #6c7086; font-family: ui-monospace, 'SF Mono', monospace; white-space: nowrap; }
.progress-bar { width: 100px; height: 4px; background: #313244; border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #cba6f7, #89b4fa); border-radius: 2px; transition: width 0.15s ease; }
.progress-percent { font-size: 12px; font-weight: 600; color: #89b4fa; font-family: system-ui, sans-serif; min-width: 36px; text-align: right; }

@media (max-width: 768px) {
  .typing-control-bar { flex-wrap: wrap; gap: 8px; padding: 8px 12px; }
  .speed-slider { width: 60px; }
  .progress-bar { width: 60px; }
}
</style>
