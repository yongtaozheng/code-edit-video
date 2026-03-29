import type { LineAction, FrameworkSlot, SlotAction } from '../types'

/** Regex to detect action markers at the end of a line */
const ACTION_MATCH_RE = /(?:<!--\s*\[(pause|quick|ignore|save)\]\s*-->|\/\*\s*\[(pause|quick|ignore|save)\]\s*\*\/|(?:\/\/|#)\s*\[(pause|quick|ignore|save)\])\s*$/

/** Regex to strip action markers (including preceding whitespace) from a line */
const ACTION_STRIP_RE = /\s*(?:<!--\s*\[(pause|quick|ignore|save)\]\s*-->|\/\*\s*\[(pause|quick|ignore|save)\]\s*\*\/|(?:\/\/|#)\s*\[(pause|quick|ignore|save)\])\s*$/

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
    const actionMatch = line.match(ACTION_MATCH_RE)

    if (actionMatch) {
      const actionType = (actionMatch[1] || actionMatch[2] || actionMatch[3]) as 'pause' | 'quick' | 'ignore' | 'save'
      const cleanLine = line.replace(ACTION_STRIP_RE, '')

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

  const cleanCode = cleanLines.join('\n')

  // Fix: for the last clean line, lineEnd may point past the end of cleanCode
  // because charIndex adds +1 for a newline that doesn't exist on the final line.
  // Clamp lineEnd so save/pause actions on the last line still trigger correctly.
  for (const action of actions) {
    if (action.lineEnd >= cleanCode.length) {
      action.lineEnd = cleanCode.length - 1
    }
  }

  return {
    cleanCode,
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
 * Parse action markers from slot content lines and return cleaned lines + actions.
 */
function parseSlotLineActions(slotLines: string[]): { cleanLines: string[]; actions: SlotAction[] } {
  const cleanLines: string[] = []
  // Map from clean line index to action type
  const lineActionMap: (('pause' | 'quick' | 'save') | null)[] = []

  for (const line of slotLines) {
    const actionMatch = line.match(ACTION_MATCH_RE)
    if (actionMatch) {
      const actionType = (actionMatch[1] || actionMatch[2] || actionMatch[3]) as 'pause' | 'quick' | 'ignore' | 'save'
      if (actionType === 'ignore') {
        continue // skip this line entirely
      }
      const cleanLine = line.replace(ACTION_STRIP_RE, '')
      cleanLines.push(cleanLine)
      lineActionMap.push(actionType)
    } else {
      cleanLines.push(line)
      lineActionMap.push(null)
    }
  }

  // Build SlotAction list with character offsets within the slot content.
  // Slot content format: '\n' + cleanLines.join('\n') + '\n'
  const actions: SlotAction[] = []
  let offset = 1 // skip initial '\n'
  for (let j = 0; j < cleanLines.length; j++) {
    const lineStartOffset = offset
    const lineEndOffset = offset + cleanLines[j].length // position of '\n' after this line
    offset = lineEndOffset + 1 // skip past the '\n'

    if (lineActionMap[j]) {
      actions.push({
        type: lineActionMap[j]!,
        lineStartOffset,
        lineEndOffset,
      })
    }
  }

  return { cleanLines, actions }
}

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
        const { cleanLines: cleanSlotLines, actions: slotActions } = parseSlotLineActions(currentSlotLines)
        const content = '\n' + cleanSlotLines.join('\n') + '\n'
        const frameworkSoFar = frameworkLines.join('\n')
        const insertPosition = frameworkSoFar.length + (frameworkLines.length > 0 ? 1 : 0)
        slots.push({
          content,
          insertPosition,
          order: currentSlotOrder >= 0 ? currentSlotOrder : positionalIndex,
          pauseAfter: currentSlotPauseAfter,
          actions: slotActions,
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
    const { cleanLines: cleanSlotLines, actions: slotActions } = parseSlotLineActions(currentSlotLines)
    const content = '\n' + cleanSlotLines.join('\n') + '\n'
    const frameworkSoFar = frameworkLines.join('\n')
    const insertPosition = frameworkSoFar.length + (frameworkLines.length > 0 ? 1 : 0)
    slots.push({
      content,
      insertPosition,
      order: currentSlotOrder >= 0 ? currentSlotOrder : positionalIndex,
      pauseAfter: currentSlotPauseAfter,
      actions: slotActions,
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
