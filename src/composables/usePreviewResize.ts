import { ref } from 'vue'

export function usePreviewResize() {
  const previewWidth = ref(380)
  const previewHeight = ref(280)
  const isResizing = ref(false)

  // Private state
  const resizeStartX = ref(0)
  const resizeStartY = ref(0)
  const resizeStartW = ref(0)
  const resizeStartH = ref(0)

  function onResizeMove(e: MouseEvent) {
    if (!isResizing.value) return
    const deltaX = resizeStartX.value - e.clientX
    const deltaY = resizeStartY.value - e.clientY
    const newWidth = Math.max(280, Math.min(resizeStartW.value + deltaX, window.innerWidth - 40))
    const newHeight = Math.max(200, Math.min(resizeStartH.value + deltaY, window.innerHeight - 40))
    previewWidth.value = newWidth
    previewHeight.value = newHeight
  }

  function onResizeEnd() {
    isResizing.value = false
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
  }

  function onResizeStart(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    isResizing.value = true
    resizeStartX.value = e.clientX
    resizeStartY.value = e.clientY
    resizeStartW.value = previewWidth.value
    resizeStartH.value = previewHeight.value
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd)
  }

  function cleanup() {
    document.removeEventListener('mousemove', onResizeMove)
    document.removeEventListener('mouseup', onResizeEnd)
  }

  return {
    previewWidth,
    previewHeight,
    isResizing,
    onResizeStart,
    cleanup,
  }
}
