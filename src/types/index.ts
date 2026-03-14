export type TypingMode = 'auto' | 'manual'
export type SpeedPreset = 'slow' | 'medium' | 'fast'

export interface LineAction {
  type: 'pause' | 'quick' | 'ignore'
  lineStart: number
  lineEnd: number
  cleanLine: string
}

export interface FrameworkSlot {
  content: string
  insertPosition: number
  order: number
  pauseAfter: boolean
}

export interface SplitResult {
  html: string
  css: string
  js: string
}
