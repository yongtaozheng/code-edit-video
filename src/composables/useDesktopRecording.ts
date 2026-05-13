import { ref } from 'vue'
import { invoke, Channel } from '@tauri-apps/api/core'

type RecordingMode = 'display' | 'canvas' | 'desktop'

/**
 * Recording event from Rust backend (Tauri Channel).
 *
 * Uses tagged union format: { event: 'eventName', data: { ... } }
 */
type RecordingEvent =
  | { event: 'started' }
  | {
      event: 'progress'
      data: { durationSecs: number; frameCount: number; fileSizeBytes: number }
    }
  | {
      event: 'finished'
      data: {
        filePath: string
        totalFrames: number
        totalDurationSecs: number
        fileSizeBytes: number
      }
    }
  | { event: 'error'; data: { message: string } }

/**
 * Desktop recording composable for Tauri environment.
 *
 * Uses Tauri IPC to call Rust backend which captures the window via xcap
 * and encodes to H.264 MP4 via openh264 + minimp4.
 *
 * PUBLIC INTERFACE IS IDENTICAL to useScreenRecording() — they are interchangeable.
 */
export function useDesktopRecording() {
  // ==================== Public State (same interface as useScreenRecording) ====================
  const autoRecord = ref(false)
  const autoStopRecord = ref(true)
  const autoExpandPreviewOnComplete = ref(true)
  const autoStopDelaySeconds = ref(20)
  const isRecording = ref(false)
  const isAutoRecording = ref(false)
  const recordingDuration = ref('00:00')
  const recordingError = ref('')
  const recordingMode = ref<RecordingMode>('desktop')
  const captureTargetRef = ref<HTMLElement | null>(null) // kept for interface compat, not used

  // ==================== Private State ====================
  const recordingStartTime = ref(0)
  const recordingTimerInterval = ref<ReturnType<typeof setInterval> | null>(null)
  const autoStopTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  // ==================== Helpers ====================

  function updateRecordingDuration() {
    const elapsed = Math.floor((Date.now() - recordingStartTime.value) / 1000)
    const minutes = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, '0')
    const seconds = (elapsed % 60).toString().padStart(2, '0')
    recordingDuration.value = `${minutes}:${seconds}`
  }

  function cleanupRecordingResources() {
    isRecording.value = false
    isAutoRecording.value = false
    clearAutoStopTimer()
    if (recordingTimerInterval.value) {
      clearInterval(recordingTimerInterval.value)
      recordingTimerInterval.value = null
    }
  }

  function clearAutoStopTimer() {
    if (autoStopTimer.value) {
      clearTimeout(autoStopTimer.value)
      autoStopTimer.value = null
    }
  }

  function checkRecordingSupport(): string | null {
    // Desktop recording is always available in Tauri
    return null
  }

  // ==================== Recording API ====================

  async function startRecording(auto: boolean = false): Promise<boolean> {
    if (isRecording.value) return true
    recordingError.value = ''
    clearAutoStopTimer()

    try {
      // Create a Tauri Channel for receiving progress events from Rust
      const onProgress = new Channel<RecordingEvent>()

      onProgress.onmessage = (message: RecordingEvent) => {
        switch (message.event) {
          case 'started':
            // Recording confirmed started on the backend
            break

          case 'progress':
            // Update duration from backend (we also track locally for responsiveness)
            break

          case 'finished':
            // Recording completed and MP4 saved
            cleanupRecordingResources()
            break

          case 'error':
            recordingError.value = message.data.message
            cleanupRecordingResources()
            break
        }
      }

      // Call Rust backend to start recording
      await invoke('start_recording', {
        fps: 30,
        onProgress,
      })

      // Update local state
      isRecording.value = true
      isAutoRecording.value = auto
      recordingMode.value = 'desktop'
      recordingStartTime.value = Date.now()
      recordingDuration.value = '00:00'
      recordingTimerInterval.value = setInterval(updateRecordingDuration, 1000)

      return true
    } catch (err: any) {
      // Handle user cancelling save dialog or other startup errors
      const message = typeof err === 'string' ? err : err?.message || '未知错误'
      if (message.includes('cancelled') || message.includes('Cancel')) {
        // User cancelled save dialog — not an error
        recordingError.value = ''
      } else {
        recordingError.value = `桌面录屏启动失败: ${message}`
      }
      cleanupRecordingResources()
      return false
    }
  }

  function stopRecordingAndDownload() {
    if (!isRecording.value) return
    clearAutoStopTimer()

    invoke('stop_recording').catch((err: any) => {
      const message = typeof err === 'string' ? err : err?.message || '未知错误'
      recordingError.value = `停止录屏失败: ${message}`
    })
    // Cleanup happens when 'finished' event arrives via the Channel
  }

  function autoStopRecordingIfNeeded(options?: { onDelayStart?: () => void }) {
    if (!isRecording.value || !isAutoRecording.value || !autoStopRecord.value) return

    clearAutoStopTimer()
    options?.onDelayStart?.()

    const delayMs = Math.max(0, Math.floor(autoStopDelaySeconds.value)) * 1000
    if (delayMs === 0) {
      stopRecordingAndDownload()
      return
    }

    autoStopTimer.value = setTimeout(() => {
      autoStopTimer.value = null
      if (isRecording.value && isAutoRecording.value && autoStopRecord.value) {
        stopRecordingAndDownload()
      }
    }, delayMs)
  }

  async function toggleManualRecording() {
    if (isRecording.value) {
      stopRecordingAndDownload()
    } else {
      await startRecording(false)
    }
  }

  // ==================== Return (identical interface to useScreenRecording) ====================

  return {
    autoRecord,
    autoStopRecord,
    autoExpandPreviewOnComplete,
    autoStopDelaySeconds,
    isRecording,
    isAutoRecording,
    recordingDuration,
    recordingError,
    recordingMode,
    captureTargetRef,
    checkRecordingSupport,
    startRecording,
    toggleManualRecording,
    stopRecordingAndDownload,
    autoStopRecordingIfNeeded,
    cleanupRecordingResources,
  }
}
