import { useScreenRecording } from './useScreenRecording'
import { useDesktopRecording } from './useDesktopRecording'

/**
 * Environment-aware recording facade.
 *
 * Automatically selects the best recording implementation:
 * - Tauri desktop: uses native window capture + H.264 encoding (useDesktopRecording)
 * - Browser: uses existing getDisplayMedia / canvas fallback (useScreenRecording)
 *
 * Both composables expose the identical public interface, so consumers
 * (CodeDisplay.vue, TypingControlBar.vue) don't need any changes.
 */
export function useRecording() {
  if (isTauriEnvironment()) {
    return useDesktopRecording()
  }
  return useScreenRecording()
}

/**
 * Detect whether the app is running inside a Tauri webview.
 *
 * Tauri v2 injects `__TAURI_INTERNALS__` on the window object.
 */
function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  )
}
