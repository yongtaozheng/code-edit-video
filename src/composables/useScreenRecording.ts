import { ref } from 'vue'

export function useScreenRecording() {
  // Public state
  const autoRecord = ref(false)
  const autoStopRecord = ref(true)
  const isRecording = ref(false)
  const isAutoRecording = ref(false)
  const recordingDuration = ref('00:00')

  // Private state
  const mediaRecorder = ref<MediaRecorder | null>(null)
  const recordedChunks = ref<Blob[]>([])
  const mediaStream = ref<MediaStream | null>(null)
  const recordingStartTime = ref(0)
  const recordingTimerInterval = ref<ReturnType<typeof setInterval> | null>(null)

  function updateRecordingDuration() {
    const elapsed = Math.floor((Date.now() - recordingStartTime.value) / 1000)
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0')
    const seconds = (elapsed % 60).toString().padStart(2, '0')
    recordingDuration.value = `${minutes}:${seconds}`
  }

  function getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ]
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return 'video/webm'
  }

  function downloadRecording() {
    if (recordedChunks.value.length === 0) return

    const mimeType = mediaRecorder.value?.mimeType || 'video/webm'
    const blob = new Blob(recordedChunks.value, { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
    a.href = url
    a.download = `code-typing-${timestamp}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    recordedChunks.value = []
  }

  function cleanupRecordingResources() {
    isRecording.value = false
    isAutoRecording.value = false
    if (recordingTimerInterval.value) {
      clearInterval(recordingTimerInterval.value)
      recordingTimerInterval.value = null
    }
    if (mediaStream.value) {
      mediaStream.value.getTracks().forEach(track => track.stop())
      mediaStream.value = null
    }
    mediaRecorder.value = null
  }

  function stopRecordingAndDownload() {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
    } else {
      cleanupRecordingResources()
    }
  }

  function autoStopRecordingIfNeeded() {
    if (isRecording.value && isAutoRecording.value && autoStopRecord.value) {
      stopRecordingAndDownload()
    }
  }

  async function startRecording(auto: boolean = false): Promise<boolean> {
    if (isRecording.value) return true

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: true,
      })
      mediaStream.value = stream

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (isRecording.value) {
          stopRecordingAndDownload()
        }
      })

      const recorder = new MediaRecorder(stream, {
        mimeType: getSupportedMimeType(),
      })

      recordedChunks.value = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.value.push(event.data)
        }
      }

      recorder.onstop = () => {
        downloadRecording()
        cleanupRecordingResources()
      }

      mediaRecorder.value = recorder
      recorder.start(100)
      isRecording.value = true
      isAutoRecording.value = auto
      recordingStartTime.value = Date.now()
      recordingDuration.value = '00:00'
      recordingTimerInterval.value = setInterval(updateRecordingDuration, 1000)

      return true
    } catch (err) {
      console.warn('Screen recording permission denied or failed:', err)
      cleanupRecordingResources()
      return false
    }
  }

  async function toggleManualRecording() {
    if (isRecording.value) {
      stopRecordingAndDownload()
    } else {
      await startRecording(false)
    }
  }

  return {
    autoRecord,
    autoStopRecord,
    isRecording,
    isAutoRecording,
    recordingDuration,
    startRecording,
    toggleManualRecording,
    stopRecordingAndDownload,
    autoStopRecordingIfNeeded,
    cleanupRecordingResources,
  }
}
