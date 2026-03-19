import type { LineAction, FrameworkSlot } from '../types'

/**
 * Parse action markers from code lines.
 */
export function parseAndCleanCode(rawCode: string): { cleanCode: string; actions: LineAction[] } {
  const lines = rawCode.split('\n')
  const actions: LineAction[] = []
  const cleanLines: string[] = []
  let charIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const actionMatch = line.match(/(?:<!--\s*\[(pause|quick|ignore|save)\]\s*-->|\/\*\s*\[(pause|quick|ignore|save)\]\s*\*\/|(?:\/\/|#)\s*\[(pause|quick|ignore|save)\])\s*$/)

    if (actionMatch) {
      const actionType = (actionMatch[1] || actionMatch[2] || actionMatch[3]) as 'pause' | 'quick' | 'ignore' | 'save'
      const cleanLine = line.replace(/\s*(?:<!--\s*\[(pause|quick|ignore|save)\]\s*-->|\/\*\s*\[(pause|quick|ignore|save)\]\s*\*\/|(?:\/\/|#)\s*\[(pause|quick|ignore|save)\])\s*$/, '')

      if (actionType === 'ignore') {
        continue
      }

      cleanLines.push(cleanLine)
      const lineStart = charIndex
      charIndex += cleanLine.length + 1
      actions.push({
        type: actionType,
        lineStart,
        lineEnd: charIndex - 1,
        cleanLine,
      })
    } else {
      cleanLines.push(line)
      charIndex += line.length + 1
    }
  }

  return {
    cleanCode: cleanLines.join('\n'),
    actions,
  }
}

/**
 * Check if current typing position hits any line action.
 */
export function getActionAtIndex(index: number, actions: LineAction[]): LineAction | null {
  for (const action of actions) {
    if (index === action.lineStart) {
      return action
    }
  }
  return null
}

/**
 * Parse framework code with [slot] markers.
 */
export function parseFrameworkCode(rawCode: string): {
  framework: string
  slots: FrameworkSlot[]
  hasSlots: boolean
} {
  const lines = rawCode.split('\n')
  const frameworkLines: string[] = []
  const slots: FrameworkSlot[] = []
  let inSlot = false
  let currentSlotLines: string[] = []
  let currentSlotOrder = -1
  let currentSlotPauseAfter = true
  let positionalIndex = 0

  const slotStartRe = /^\s*(?:<!--\s*\[slot((?::[^\]]*)*)\]\s*-->|\/\*\s*\[slot((?::[^\]]*)*)\]\s*\*\/|(?:\/\/|#)\s*\[slot((?::[^\]]*)*)\])\s*$/
  const slotEndRe = /^\s*(?:<!--\s*\[\/slot\]\s*-->|\/\*\s*\[\/slot\]\s*\*\/|(?:\/\/|#)\s*\[\/slot\])\s*$/

  for (const line of lines) {
    const startMatch = line.match(slotStartRe)
    if (startMatch) {
      inSlot = true
      currentSlotLines = []
      const params = (startMatch[1] || startMatch[2] || startMatch[3] || '').replace(/^:/, '')
      currentSlotOrder = -1
      currentSlotPauseAfter = true
      if (params) {
        for (const part of params.split(':')) {
          const trimmed = part.trim()
          if (trimmed === 'nopause') {
            currentSlotPauseAfter = false
          } else if (/^\d+$/.test(trimmed)) {
            currentSlotOrder = parseInt(trimmed, 10)
          }
        }
      }
      continue
    }

    if (slotEndRe.test(line)) {
      if (inSlot && currentSlotLines.length > 0) {
        const content = '\n' + currentSlotLines.join('\n') + '\n'
        const frameworkSoFar = frameworkLines.join('\n')
        const insertPosition = frameworkSoFar.length + (frameworkLines.length > 0 ? 1 : 0)
        slots.push({
          content,
          insertPosition,
          order: currentSlotOrder >= 0 ? currentSlotOrder : positionalIndex,
          pauseAfter: currentSlotPauseAfter,
        })
        positionalIndex++
      }
      inSlot = false
      continue
    }

    if (inSlot) {
      currentSlotLines.push(line)
    } else {
      frameworkLines.push(line)
    }
  }

  if (inSlot && currentSlotLines.length > 0) {
    const content = '\n' + currentSlotLines.join('\n') + '\n'
    const frameworkSoFar = frameworkLines.join('\n')
    const insertPosition = frameworkSoFar.length + (frameworkLines.length > 0 ? 1 : 0)
    slots.push({
      content,
      insertPosition,
      order: currentSlotOrder >= 0 ? currentSlotOrder : positionalIndex,
      pauseAfter: currentSlotPauseAfter,
    })
  }

  return {
    framework: frameworkLines.join('\n'),
    slots,
    hasSlots: slots.length > 0,
  }
}

/**
 * Compute execution order: sort slots by their `order` field.
 */
export function computeSlotExecOrder(slots: FrameworkSlot[]): number[] {
  const indices = slots.map((_, i) => i)
  indices.sort((a, b) => {
    const orderDiff = slots[a].order - slots[b].order
    return orderDiff !== 0 ? orderDiff : a - b
  })
  return indices
}
