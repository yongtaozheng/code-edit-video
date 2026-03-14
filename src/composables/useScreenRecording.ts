import { ref } from 'vue'

type RecordingMode = 'display' | 'canvas'

// Lazy-loaded html-to-image reference (SVG foreignObject 方案，比 html2canvas 快 3-10 倍)
let toCanvasFn: ((node: HTMLElement, options?: any) => Promise<HTMLCanvasElement>) | null = null

export function useScreenRecording() {
  // ==================== Public State ====================
  const autoRecord = ref(false)
  const autoStopRecord = ref(true)
  const isRecording = ref(false)
  const isAutoRecording = ref(false)
  const recordingDuration = ref('00:00')
  const recordingError = ref('')
  const recordingMode = ref<RecordingMode>('display')
  const captureTargetRef = ref<HTMLElement | null>(null)

  // ==================== Private State ====================
  const mediaRecorder = ref<MediaRecorder | null>(null)
  const recordedChunks = ref<Blob[]>([])
  const mediaStream = ref<MediaStream | null>(null)
  const recordingStartTime = ref(0)
  const recordingTimerInterval = ref<ReturnType<typeof setInterval> | null>(null)

  // Canvas recording private state
  let captureTimerId: ReturnType<typeof setInterval> | null = null
  let captureRafId: number | null = null
  let canvasEl: HTMLCanvasElement | null = null
  let mutationObserver: MutationObserver | null = null
  let isDirty = true
  let lastCaptureTime = 0

  // ==================== Shared Helpers ====================

  function updateRecordingDuration() {
    const elapsed = Math.floor((Date.now() - recordingStartTime.value) / 1000)
    const minutes = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, '0')
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

  function cleanupCanvasResources() {
    if (captureTimerId) {
      clearInterval(captureTimerId)
      captureTimerId = null
    }
    if (captureRafId) {
      cancelAnimationFrame(captureRafId)
      captureRafId = null
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
      mutationObserver = null
    }
    isDirty = true
    lastCaptureTime = 0
    canvasEl = null
  }

  function cleanupRecordingResources() {
    isRecording.value = false
    isAutoRecording.value = false
    if (recordingTimerInterval.value) {
      clearInterval(recordingTimerInterval.value)
      recordingTimerInterval.value = null
    }
    if (mediaStream.value) {
      mediaStream.value.getTracks().forEach((track) => track.stop())
      mediaStream.value = null
    }
    mediaRecorder.value = null
    cleanupCanvasResources()
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

  // ==================== Mode Detection ====================

  /**
   * Detect the best available recording mode:
   * - 'display': getDisplayMedia (requires HTTPS / secure context)
   * - 'canvas':  html-to-image + canvas.captureStream() (works on HTTP)
   * - null:      no recording support
   */
  function getAvailableMode(): RecordingMode | null {
    // Prefer native screen capture when available (HTTPS or localhost)
    if (
      window.isSecureContext &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    ) {
      return 'display'
    }
    // Fallback: canvas-based capture (works on plain HTTP)
    if (
      typeof MediaRecorder !== 'undefined' &&
      'captureStream' in HTMLCanvasElement.prototype
    ) {
      return 'canvas'
    }
    return null
  }

  function checkRecordingSupport(): string | null {
    const mode = getAvailableMode()
    if (!mode) {
      return '当前浏览器不支持录屏功能，请使用最新版 Chrome / Edge 浏览器，或通过 HTTPS 访问。'
    }
    if (mode === 'canvas' && !captureTargetRef.value) {
      return '画布录屏模式需要指定录制目标元素。'
    }
    return null
  }

  // ==================== Display Recording (HTTPS) ====================

  async function startDisplayRecording(auto: boolean): Promise<boolean> {
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
      recordingMode.value = 'display'
      recordingStartTime.value = Date.now()
      recordingDuration.value = '00:00'
      recordingTimerInterval.value = setInterval(updateRecordingDuration, 1000)

      return true
    } catch (err: any) {
      console.warn('Screen recording permission denied or failed:', err)
      if (err?.name === 'NotAllowedError') {
        recordingError.value = '录屏权限被拒绝，请在弹出的权限对话框中允许屏幕共享。'
      } else if (err?.name === 'NotFoundError') {
        recordingError.value = '未找到可用的屏幕共享源。'
      } else if (err?.name === 'NotSupportedError') {
        recordingError.value = '当前环境不支持录屏，请确保使用 HTTPS 访问。'
      } else {
        recordingError.value = `录屏启动失败: ${err?.message || '未知错误'}`
      }
      cleanupRecordingResources()
      return false
    }
  }

  // ==================== Canvas Recording (HTTP fallback) ====================
  // 使用 html-to-image (SVG foreignObject) 替代 html2canvas
  // 原理：将 DOM 序列化为 SVG foreignObject，由浏览器原生渲染引擎绘制
  // 性能：比 html2canvas 快 3-10 倍（html2canvas 用 JS 重新实现了 CSS 渲染）

  /**
   * 将 html-to-image 渲染的临时 canvas 绘制到录制用的持久 canvas 上
   */
  async function renderFrameToCanvas(
    target: HTMLElement,
    toCanvas: (node: HTMLElement, options?: any) => Promise<HTMLCanvasElement>,
    scale: number,
  ) {
    if (!canvasEl) return

    // Adapt to resize
    const currentRect = target.getBoundingClientRect()
    const w = Math.floor(currentRect.width * scale)
    const h = Math.floor(currentRect.height * scale)
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w
      canvasEl.height = h
    }

    // html-to-image 每次返回新 canvas，需要绘制到我们的持久 canvas 上
    const rendered = await toCanvas(target, {
      pixelRatio: scale,
      backgroundColor: null,
    })

    const ctx = canvasEl.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
      ctx.drawImage(rendered, 0, 0, canvasEl.width, canvasEl.height)
    }
  }

  async function startCanvasRecording(auto: boolean): Promise<boolean> {
    const target = captureTargetRef.value
    if (!target) {
      recordingError.value = '录屏目标元素未设置。'
      return false
    }

    try {
      // Lazy load html-to-image only when needed
      if (!toCanvasFn) {
        const mod = await import('html-to-image')
        toCanvasFn = mod.toCanvas
      }
      const toCanvas = toCanvasFn

      const rect = target.getBoundingClientRect()
      // ⚡ 优化: 固定 1x 缩放，减少像素处理量
      const scale = 1

      // Create persistent canvas for recording (captureStream 绑定此 canvas)
      canvasEl = document.createElement('canvas')
      canvasEl.width = Math.floor(rect.width * scale)
      canvasEl.height = Math.floor(rect.height * scale)

      // Render initial frame
      await renderFrameToCanvas(target, toCanvas, scale)

      // Create MediaStream from canvas (0 = manual frame control via requestFrame)
      const stream = (canvasEl as any).captureStream(0) as MediaStream
      mediaStream.value = stream

      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })

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

      // ⚡ 使用 MutationObserver 监听 DOM 变化，仅在内容变化时才截帧
      isDirty = false // Initial frame already captured
      mutationObserver = new MutationObserver(() => {
        isDirty = true
      })
      mutationObserver.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      })

      // ⚡ 使用 requestAnimationFrame 替代 setInterval，与浏览器渲染管线同步
      let isCapturing = false
      const CAPTURE_MIN_INTERVAL = 100 // html-to-image 更快，可以支持 ~10 FPS

      function captureLoop() {
        if (!isRecording.value || !canvasEl) return

        captureRafId = requestAnimationFrame(async () => {
          const now = performance.now()

          // 跳过条件：正在截帧中 / DOM 未变化 / 距上次截帧时间不够
          if (
            isCapturing ||
            !isDirty ||
            now - lastCaptureTime < CAPTURE_MIN_INTERVAL
          ) {
            captureLoop()
            return
          }

          isCapturing = true
          isDirty = false
          lastCaptureTime = now

          try {
            await renderFrameToCanvas(target, toCanvas, scale)

            // Signal new frame to captureStream
            const track = stream.getVideoTracks()[0]
            if (track && 'requestFrame' in track) {
              ;(track as any).requestFrame()
            }
          } catch (e) {
            console.warn('Canvas capture frame error:', e)
          } finally {
            isCapturing = false
          }

          captureLoop()
        })
      }

      captureLoop()

      isRecording.value = true
      isAutoRecording.value = auto
      recordingMode.value = 'canvas'
      recordingStartTime.value = Date.now()
      recordingDuration.value = '00:00'
      recordingTimerInterval.value = setInterval(updateRecordingDuration, 1000)

      return true
    } catch (err: any) {
      console.warn('Canvas recording failed:', err)
      recordingError.value = `画布录屏启动失败: ${err?.message || '未知错误'}`
      cleanupRecordingResources()
      return false
    }
  }

  // ==================== Public Recording API ====================

  async function startRecording(auto: boolean = false): Promise<boolean> {
    if (isRecording.value) return true
    recordingError.value = ''

    const supportError = checkRecordingSupport()
    if (supportError) {
      recordingError.value = supportError
      return false
    }

    const mode = getAvailableMode()!
    return mode === 'display' ? startDisplayRecording(auto) : startCanvasRecording(auto)
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
