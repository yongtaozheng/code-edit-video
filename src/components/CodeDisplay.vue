<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import 'highlight.js/styles/atom-one-dark.css'

hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)

// ==================== Types ====================
type TypingMode = 'auto' | 'manual'
type SpeedPreset = 'slow' | 'medium' | 'fast'

// Line action parsed from comment markers
interface LineAction {
  type: 'pause' | 'quick' | 'ignore'
  lineStart: number  // char index where line starts in target
  lineEnd: number    // char index where line ends in target
  cleanLine: string  // line content without the action marker
}

// Framework mode: a slot where code snippets will be typed into
interface FrameworkSlot {
  content: string          // The code snippet to type into this slot
  insertPosition: number   // Character position in the framework base string
  order: number            // Execution order (lower = first); default = positional index
  pauseAfter: boolean      // Whether to auto-pause after this slot completes
}

// ==================== Editor State ====================
const code = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const codeDisplayRef = ref<HTMLElement | null>(null)
const lineNumbersRef = ref<HTMLElement | null>(null)
const previewExpanded = ref(false)

// ==================== Typing Simulation State ====================
const showPasteModal = ref(false)
const pasteCode = ref('')
const pasteTextareaRef = ref<HTMLTextAreaElement | null>(null)

// Typing engine
const targetCode = ref('')       // The cleaned code (action markers removed)
const rawTargetCode = ref('')    // Original code with markers
const currentIndex = ref(0)
const isTyping = ref(false)
const isPaused = ref(false)
const typingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const typingComplete = ref(false)

// New features inspired by typing-simulator & swimming
const typingMode = ref<TypingMode>('auto')
const speedPreset = ref<SpeedPreset>('medium')
const typingSpeed = ref(80)       // base delay ms (derived from preset)
const manualCharsPerKey = ref(1)  // chars to type per keypress in manual mode
const lineActions = ref<LineAction[]>([])

// Screen recording
const autoRecord = ref(false)          // Whether to auto-start recording when typing begins
const autoStopRecord = ref(true)       // Whether to auto-stop recording when typing completes (only for auto-record)
const isRecording = ref(false)         // Currently recording
const isAutoRecording = ref(false)     // true = started by auto-record (auto-stops); false = manual (user controls)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])
const mediaStream = ref<MediaStream | null>(null)
const recordingStartTime = ref(0)
const recordingDuration = ref('00:00')
const recordingTimerInterval = ref<ReturnType<typeof setInterval> | null>(null)

// Framework mode: display skeleton first, then type snippets at marked positions
const isFrameworkMode = ref(false)
const frameworkBase = ref('')              // The skeleton code (everything outside [slot] blocks)
const frameworkSlots = ref<FrameworkSlot[]>([])
const slotExecOrder = ref<number[]>([])   // Execution order: maps step index → slot index in frameworkSlots
const currentSlotIndex = ref(0)           // Current step in slotExecOrder (NOT the slot index!)
const currentSlotCharIndex = ref(0)       // Character position within current slot

// ==================== Speed Preset Mapping ====================
const speedPresetMap: Record<SpeedPreset, number> = {
  slow: 150,
  medium: 80,
  fast: 30,
}

watch(speedPreset, (preset) => {
  typingSpeed.value = speedPresetMap[preset]
})

// ==================== Computed Properties ====================
const highlightedCode = computed(() => {
  try {
    const result = hljs.highlight(code.value, { language: 'xml' })
    return result.value
  } catch {
    return code.value
  }
})

const lineNumbers = computed(() => {
  const lines = code.value.split('\n')
  return lines.map((_, i) => i + 1)
})

const frameworkTypedChars = computed(() => {
  let chars = 0
  const execOrder = slotExecOrder.value
  for (let e = 0; e < currentSlotIndex.value && e < execOrder.length; e++) {
    chars += frameworkSlots.value[execOrder[e]].content.length
  }
  if (currentSlotIndex.value < execOrder.length) {
    chars += currentSlotCharIndex.value
  }
  return chars
})

const frameworkTotalChars = computed(() => {
  return frameworkSlots.value.reduce((sum, s) => sum + s.content.length, 0)
})

const typingProgress = computed(() => {
  if (isFrameworkMode.value) {
    if (frameworkTotalChars.value === 0) return 100
    return Math.round((frameworkTypedChars.value / frameworkTotalChars.value) * 100)
  }
  if (!targetCode.value) return 0
  return Math.round((currentIndex.value / targetCode.value.length) * 100)
})

const typingStatusText = computed(() => {
  if (typingComplete.value) return '已完成'
  if (isFrameworkMode.value) {
    const totalSlots = slotExecOrder.value.length
    const slotNum = Math.min(currentSlotIndex.value + 1, totalSlots)
    if (isPaused.value) return `片段 ${slotNum}/${totalSlots} · 按空格继续`
    if (isTyping.value && typingMode.value === 'manual') return `片段 ${slotNum}/${totalSlots} · 按任意键输入`
    if (isTyping.value) return `片段 ${slotNum}/${totalSlots} · 输入中...`
    return '就绪'
  }
  if (isPaused.value) return '已暂停'
  if (isTyping.value && typingMode.value === 'manual') return '手动模式 · 按任意键输入'
  if (isTyping.value) return '自动输入中...'
  return '就绪'
})


// ==================== Editor Functions ====================
function syncScroll() {
  if (textareaRef.value && codeDisplayRef.value) {
    codeDisplayRef.value.scrollTop = textareaRef.value.scrollTop
    codeDisplayRef.value.scrollLeft = textareaRef.value.scrollLeft
  }
  if (textareaRef.value && lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

function handleTab(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    code.value = code.value.substring(0, start) + '  ' + code.value.substring(end)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    })
  }
}

function togglePreview() {
  previewExpanded.value = !previewExpanded.value
}

/**
 * Scroll to keep current typing position visible (centered).
 * Inspired by Swimming plugin's TextEditorRevealType.InCenter approach.
 */
function scrollToCursor() {
  nextTick(() => {
    let targetLine: number

    if (isFrameworkMode.value && currentSlotIndex.value < slotExecOrder.value.length) {
      // In framework mode, scroll to the line where current slot is being typed
      const currentCode = code.value
      const actualSlotIdx = slotExecOrder.value[currentSlotIndex.value]
      const slot = frameworkSlots.value[actualSlotIdx]
      // Calculate the insertion position in the built code string
      // Account for all slots (in insertPosition order) that appear before this slot
      // and have been typed (fully or partially)
      let insertPosInCode = slot.insertPosition
      const completedSlots = new Set<number>()
      for (let e = 0; e < currentSlotIndex.value; e++) {
        completedSlots.add(slotExecOrder.value[e])
      }
      for (let si = 0; si < frameworkSlots.value.length; si++) {
        if (si !== actualSlotIdx && frameworkSlots.value[si].insertPosition <= slot.insertPosition && completedSlots.has(si)) {
          insertPosInCode += frameworkSlots.value[si].content.length
        }
      }
      insertPosInCode += currentSlotCharIndex.value
      const codeUpToCursor = currentCode.substring(0, insertPosInCode)
      targetLine = codeUpToCursor.split('\n').length
    } else {
      targetLine = code.value.split('\n').length
    }

    const lineHeight = 22
    const targetScrollTop = Math.max(0, (targetLine * lineHeight) - 200)

    if (textareaRef.value) {
      textareaRef.value.scrollTop = targetScrollTop
    }
    if (codeDisplayRef.value) {
      codeDisplayRef.value.scrollTop = targetScrollTop
    }
    if (lineNumbersRef.value) {
      lineNumbersRef.value.scrollTop = targetScrollTop
    }
  })
}

// ==================== Line Action Parser ====================
/**
 * Parse action markers from code lines.
 * Supported markers (inspired by typing-simulator):
 *   <!--[pause]-->   Pause typing at this line
 *   <!--[quick]-->   Instantly type this entire line
 *   <!--[ignore]-->  Skip this line entirely
 *
 * Also supports /​* *​/, // and # style comments:
 *   /​*[pause]*​/  /​*[quick]*​/  /​*[ignore]*​/
 *   //[pause]  //[quick]  //[ignore]
 *   #[pause]   #[quick]   #[ignore]
 *
 * Spaces are allowed between delimiters and markers:
 *   <!--  [pause]  -->   /​*  [pause]  *​/   //  [pause]   #  [pause]
 */
function parseAndCleanCode(rawCode: string): { cleanCode: string; actions: LineAction[] } {
  const lines = rawCode.split('\n')
  const actions: LineAction[] = []
  const cleanLines: string[] = []
  let charIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const actionMatch = line.match(/(?:<!--\s*\[(pause|quick|ignore)\]\s*-->|\/\*\s*\[(pause|quick|ignore)\]\s*\*\/|(?:\/\/|#)\s*\[(pause|quick|ignore)\])\s*$/)

    if (actionMatch) {
      const actionType = (actionMatch[1] || actionMatch[2] || actionMatch[3]) as 'pause' | 'quick' | 'ignore'
      const cleanLine = line.replace(/\s*(?:<!--\s*\[(pause|quick|ignore)\]\s*-->|\/\*\s*\[(pause|quick|ignore)\]\s*\*\/|(?:\/\/|#)\s*\[(pause|quick|ignore)\])\s*$/, '')

      if (actionType === 'ignore') {
        // Skip this line entirely — don't add to cleanLines
        continue
      }

      cleanLines.push(cleanLine)
      const lineStart = charIndex
      charIndex += cleanLine.length + 1 // +1 for \n
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
 * Returns the action if we're at the start of an action line.
 */
function getActionAtIndex(index: number): LineAction | null {
  for (const action of lineActions.value) {
    if (index === action.lineStart) {
      return action
    }
  }
  return null
}

// ==================== Framework Mode Parser ====================
/**
 * Parse framework code with [slot] markers.
 * Content outside [slot]...[/slot] blocks is the "framework" (displayed instantly).
 * Content inside [slot]...[/slot] blocks are "slots" (typed in sequentially).
 *
 * Supported marker formats:
 *   <!--[slot]-->              Basic slot (default order, pause after)
 *   <!--[slot:2]-->            Custom execution order (lower = first)
 *   <!--[slot:nopause]-->      No pause after this slot finishes
 *   <!--[slot:2:nopause]-->    Custom order + no pause
 *   <!--[/slot]-->             Slot end marker
 *
 * Also supports /​* *​/, // and # comment styles:
 *   /​*[slot]*​/  /​*[slot:2:nopause]*​/  /​*[/slot]*​/
 *   //[slot]  //[slot:2:nopause]  //[/slot]
 *   #[slot]   #[slot:1:nopause]   #[/slot]
 *
 * Spaces are allowed between delimiters and markers:
 *   <!--  [slot]  -->   /​*  [slot]  *​/   //  [slot]   #  [slot]
 */
function parseFrameworkCode(rawCode: string): {
  framework: string
  slots: FrameworkSlot[]
  hasSlots: boolean
} {
  const lines = rawCode.split('\n')
  const frameworkLines: string[] = []
  const slots: FrameworkSlot[] = []
  let inSlot = false
  let currentSlotLines: string[] = []
  let currentSlotOrder = -1       // -1 = auto (positional index)
  let currentSlotPauseAfter = true
  let positionalIndex = 0

  // Match slot start with optional params:  <!--[slot]-->  /*[slot]*/  //[slot]  #[slot]  (spaces allowed)
  const slotStartRe = /^\s*(?:<!--\s*\[slot((?::[^\]]*)*)\]\s*-->|\/\*\s*\[slot((?::[^\]]*)*)\]\s*\*\/|(?:\/\/|#)\s*\[slot((?::[^\]]*)*)\])\s*$/
  const slotEndRe = /^\s*(?:<!--\s*\[\/slot\]\s*-->|\/\*\s*\[\/slot\]\s*\*\/|(?:\/\/|#)\s*\[\/slot\])\s*$/

  for (const line of lines) {
    const startMatch = line.match(slotStartRe)
    if (startMatch) {
      inSlot = true
      currentSlotLines = []
      // Parse params from the captured group (e.g., ":2:nopause" or ":nopause" or "")
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
        const content = currentSlotLines.join('\n') + '\n'
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

  // Handle unclosed slot (treat remaining as slot content)
  if (inSlot && currentSlotLines.length > 0) {
    const content = currentSlotLines.join('\n') + '\n'
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
 * Compute execution order: sort slots by their `order` field,
 * with ties broken by original positional index (stable sort).
 * Returns an array of indices into the frameworkSlots array.
 */
function computeSlotExecOrder(slots: FrameworkSlot[]): number[] {
  const indices = slots.map((_, i) => i)
  indices.sort((a, b) => {
    const orderDiff = slots[a].order - slots[b].order
    return orderDiff !== 0 ? orderDiff : a - b  // stable tie-break by position
  })
  return indices
}

/**
 * Build the full code string from framework base + typed slot content.
 * Framework is always fully displayed; each slot shows only the typed portion.
 * Uses slotExecOrder to determine which slots have been completed.
 */
function buildCodeFromSlots(): string {
  let result = ''
  let frameworkPos = 0
  const fw = frameworkBase.value
  const slots = frameworkSlots.value
  const execOrder = slotExecOrder.value
  const currentExecStep = currentSlotIndex.value
  const currentActualIdx = currentExecStep < execOrder.length ? execOrder[currentExecStep] : -1

  // Build set of completed slot indices (all execution steps before current)
  const completedSlots = new Set<number>()
  for (let e = 0; e < currentExecStep; e++) {
    completedSlots.add(execOrder[e])
  }

  // Iterate slots in insertion-position order (original array order)
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    // Add framework content up to this slot's insertion point
    result += fw.substring(frameworkPos, slot.insertPosition)
    frameworkPos = slot.insertPosition

    if (completedSlots.has(i)) {
      // This slot was fully typed in an earlier execution step
      result += slot.content
    } else if (i === currentActualIdx) {
      // This slot is currently being typed
      result += slot.content.substring(0, currentSlotCharIndex.value)
    }
    // Slots not yet reached: add nothing
  }

  // Add remaining framework content after last slot
  result += fw.substring(frameworkPos)

  return result
}

// ==================== Typing Simulation Engine ====================
/**
 * Natural typing delay with random variation.
 * Inspired by typing-simulator's delayTyping: base speed * random factor,
 * plus 10% chance of a longer "thinking" pause.
 */
function getRandomDelay(char: string, nextChar: string): number {
  const base = typingSpeed.value
  let delay = base * (0.5 + Math.random())

  // 10% chance of a longer "thinking" pause (natural pattern from typing-simulator)
  if (Math.random() < 0.1) {
    delay += base * 2.5
  }

  // Character-specific timing
  if (char === '\n') return delay * 2.2
  if (char === '>' || char === ';' || char === '}' || char === ')') return delay * 1.4
  if (char === ' ' && nextChar === ' ') return delay * 0.2  // Fast indentation
  if (char === '<' || char === '{' || char === '(') return delay * 1.2
  if (char === '=' || char === ':') return delay * 0.8

  return delay
}

function typeNextChar() {
  // Dispatch to framework mode if active
  if (isFrameworkMode.value) {
    typeNextSlotChar()
    return
  }

  if (!isTyping.value || isPaused.value) return
  if (currentIndex.value >= targetCode.value.length) {
    isTyping.value = false
    typingComplete.value = true
    autoStopRecordingIfNeeded()
    return
  }

  // Check for line actions
  const action = getActionAtIndex(currentIndex.value)
  if (action) {
    if (action.type === 'pause') {
      // Auto-pause at this line
      isPaused.value = true
      return
    }
    if (action.type === 'quick') {
      // Instantly type the entire line
      const lineContent = targetCode.value.substring(action.lineStart, action.lineEnd + 1)
      code.value += lineContent
      currentIndex.value = action.lineEnd + 1
      scrollToCursor()
      // Continue to next char after a small delay
      typingTimer.value = setTimeout(typeNextChar, 50)
      return
    }
  }

  const char = targetCode.value[currentIndex.value]
  const nextChar = targetCode.value[currentIndex.value + 1] || ''
  code.value += char
  currentIndex.value++

  scrollToCursor()

  const delay = getRandomDelay(char, nextChar)
  typingTimer.value = setTimeout(typeNextChar, delay)
}

/**
 * Framework mode: type next character in the current slot.
 * After a slot is fully typed, check pauseAfter to decide whether to pause.
 * Uses slotExecOrder to determine the actual slot being typed.
 */
function typeNextSlotChar() {
  if (!isTyping.value || isPaused.value) return

  const execOrder = slotExecOrder.value
  if (currentSlotIndex.value >= execOrder.length) {
    isTyping.value = false
    typingComplete.value = true
    autoStopRecordingIfNeeded()
    return
  }

  const actualSlotIdx = execOrder[currentSlotIndex.value]
  const currentSlot = frameworkSlots.value[actualSlotIdx]

  if (currentSlotCharIndex.value >= currentSlot.content.length) {
    // Current slot is complete
    const justFinished = currentSlot
    currentSlotIndex.value++
    currentSlotCharIndex.value = 0

    if (currentSlotIndex.value >= execOrder.length) {
      isTyping.value = false
      typingComplete.value = true
      code.value = buildCodeFromSlots()
      scrollToCursor()
      autoStopRecordingIfNeeded()
      return
    }

    code.value = buildCodeFromSlots()
    scrollToCursor()

    if (justFinished.pauseAfter) {
      // Auto-pause between slots
      isPaused.value = true
      return
    }

    // No pause — continue to next slot immediately
    typingTimer.value = setTimeout(typeNextSlotChar, 50)
    return
  }

  // Type next character
  const char = currentSlot.content[currentSlotCharIndex.value]
  const nextChar = currentSlot.content[currentSlotCharIndex.value + 1] || ''
  currentSlotCharIndex.value++

  // Rebuild code
  code.value = buildCodeFromSlots()
  scrollToCursor()

  const delay = getRandomDelay(char, nextChar)
  typingTimer.value = setTimeout(typeNextSlotChar, delay)
}

/**
 * Manual mode: type N characters per keypress.
 * Inspired by typing-simulator's manual mode where any key triggers next chars.
 */
function typeManualChunk() {
  // Dispatch to framework mode if active
  if (isFrameworkMode.value) {
    typeManualSlotChunk()
    return
  }

  if (!isTyping.value || typingComplete.value) return

  // If paused due to [pause] action, resume first
  if (isPaused.value) {
    isPaused.value = false
  }

  const charsToType = manualCharsPerKey.value

  for (let i = 0; i < charsToType; i++) {
    if (currentIndex.value >= targetCode.value.length) {
      isTyping.value = false
      typingComplete.value = true
      autoStopRecordingIfNeeded()
      break
    }

    // Check for line actions
    const action = getActionAtIndex(currentIndex.value)
    if (action) {
      if (action.type === 'pause') {
        // In manual mode, a keypress at a [pause] line resumes and starts the line
        // Don't break, just continue typing
      }
      if (action.type === 'quick') {
        const lineContent = targetCode.value.substring(action.lineStart, action.lineEnd + 1)
        code.value += lineContent
        currentIndex.value = action.lineEnd + 1
        scrollToCursor()
        return
      }
    }

    const char = targetCode.value[currentIndex.value]
    code.value += char
    currentIndex.value++
  }

  scrollToCursor()
}

/**
 * Framework mode manual: type N characters per keypress within current slot.
 * Respects pauseAfter flag when transitioning between slots.
 */
function typeManualSlotChunk() {
  if (!isTyping.value || typingComplete.value) return

  const execOrder = slotExecOrder.value
  if (currentSlotIndex.value >= execOrder.length) {
    isTyping.value = false
    typingComplete.value = true
    autoStopRecordingIfNeeded()
    return
  }

  // If paused (between slots), resume
  if (isPaused.value) {
    isPaused.value = false
  }

  const charsToType = manualCharsPerKey.value

  for (let i = 0; i < charsToType; i++) {
    if (currentSlotIndex.value >= execOrder.length) {
      isTyping.value = false
      typingComplete.value = true
      autoStopRecordingIfNeeded()
      break
    }

    const actualSlotIdx = execOrder[currentSlotIndex.value]
    const currentSlot = frameworkSlots.value[actualSlotIdx]

    if (currentSlotCharIndex.value >= currentSlot.content.length) {
      // Current slot complete
      const justFinished = currentSlot
      currentSlotIndex.value++
      currentSlotCharIndex.value = 0

      if (currentSlotIndex.value >= execOrder.length) {
        isTyping.value = false
        typingComplete.value = true
        autoStopRecordingIfNeeded()
        break
      }

      if (justFinished.pauseAfter) {
        // Pause between slots
        isPaused.value = true
        break
      }
      // No pause — continue typing into next slot in this same keypress
      continue
    }

    currentSlotCharIndex.value++
  }

  code.value = buildCodeFromSlots()
  scrollToCursor()
}

// ==================== Control Functions ====================
function openPasteModal() {
  pasteCode.value = ''
  showPasteModal.value = true
  nextTick(() => {
    pasteTextareaRef.value?.focus()
  })
}

function closePasteModal() {
  showPasteModal.value = false
  pasteCode.value = ''
}

async function startTyping() {
  if (!pasteCode.value.trim()) return

  // Start screen recording if auto-record is enabled
  if (autoRecord.value) {
    const recordingStarted = await startRecording(true)
    if (!recordingStarted) {
      // User denied permission or recording failed — continue without recording
      autoRecord.value = false
    }
  }

  // Check for framework mode ([slot] markers present)
  const { framework, slots, hasSlots } = parseFrameworkCode(pasteCode.value)

  if (hasSlots) {
    // --- Framework mode ---
    isFrameworkMode.value = true
    frameworkBase.value = framework
    frameworkSlots.value = slots
    slotExecOrder.value = computeSlotExecOrder(slots)
    currentSlotIndex.value = 0
    currentSlotCharIndex.value = 0

    rawTargetCode.value = pasteCode.value
    targetCode.value = ''
    lineActions.value = []
    currentIndex.value = 0

    // Display the framework skeleton immediately
    code.value = buildCodeFromSlots()

    isTyping.value = true
    isPaused.value = false
    typingComplete.value = false
    showPasteModal.value = false

    if (typingMode.value === 'auto') {
      // Brief pause before starting to type first slot
      typingTimer.value = setTimeout(typeNextSlotChar, 500)
    }
    // Manual mode: waits for keypresses
  } else {
    // --- Standard linear mode ---
    isFrameworkMode.value = false
    frameworkBase.value = ''
    frameworkSlots.value = []
    slotExecOrder.value = []

    const { cleanCode, actions } = parseAndCleanCode(pasteCode.value)
    rawTargetCode.value = pasteCode.value
    targetCode.value = cleanCode
    lineActions.value = actions
    currentIndex.value = 0
    code.value = ''
    isTyping.value = true
    isPaused.value = false
    typingComplete.value = false
    showPasteModal.value = false

    if (typingMode.value === 'auto') {
      typingTimer.value = setTimeout(typeNextChar, 500)
    }
    // Manual mode: waits for keypresses
  }
}

function pauseTyping() {
  isPaused.value = true
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
    typingTimer.value = null
  }
}

function resumeTyping() {
  if (!isTyping.value || !isPaused.value) return
  isPaused.value = false
  if (typingMode.value === 'auto') {
    if (isFrameworkMode.value) {
      typeNextSlotChar()
    } else {
      typeNextChar()
    }
  }
}

function togglePause() {
  if (isPaused.value) {
    resumeTyping()
  } else {
    pauseTyping()
  }
}

function stopTyping() {
  isTyping.value = false
  isPaused.value = false
  typingComplete.value = false
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
    typingTimer.value = null
  }
  targetCode.value = ''
  rawTargetCode.value = ''
  currentIndex.value = 0
  lineActions.value = []
  // Reset framework state
  isFrameworkMode.value = false
  frameworkBase.value = ''
  frameworkSlots.value = []
  slotExecOrder.value = []
  currentSlotIndex.value = 0
  currentSlotCharIndex.value = 0
  autoStopRecordingIfNeeded()
}

function finishInstantly() {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
    typingTimer.value = null
  }

  if (isFrameworkMode.value) {
    // Fill all slots completely
    currentSlotIndex.value = slotExecOrder.value.length
    currentSlotCharIndex.value = 0
    // Build final code with all slots fully inserted
    let result = ''
    let frameworkPos = 0
    for (const slot of frameworkSlots.value) {
      result += frameworkBase.value.substring(frameworkPos, slot.insertPosition)
      result += slot.content
      frameworkPos = slot.insertPosition
    }
    result += frameworkBase.value.substring(frameworkPos)
    code.value = result
  } else {
    code.value = targetCode.value
    currentIndex.value = targetCode.value.length
  }

  isTyping.value = false
  typingComplete.value = true
  scrollToCursor()
  autoStopRecordingIfNeeded()
}

// Switch between auto and manual mode mid-typing
function switchMode(mode: TypingMode) {
  if (typingMode.value === mode) return
  typingMode.value = mode

  if (isTyping.value && !isPaused.value && !typingComplete.value) {
    if (mode === 'auto') {
      // Switching to auto: start the timer
      if (isFrameworkMode.value) {
        typeNextSlotChar()
      } else {
        typeNextChar()
      }
    } else {
      // Switching to manual: stop the timer
      if (typingTimer.value) {
        clearTimeout(typingTimer.value)
        typingTimer.value = null
      }
    }
  }
}

// Watch speed changes: if currently typing in auto mode, restart timer
watch(typingSpeed, () => {
  if (isTyping.value && !isPaused.value && typingMode.value === 'auto') {
    if (typingTimer.value) {
      clearTimeout(typingTimer.value)
    }
    if (isFrameworkMode.value) {
      typeNextSlotChar()
    } else {
      typeNextChar()
    }
  }
})

// ==================== Screen Recording ====================
function updateRecordingDuration() {
  const elapsed = Math.floor((Date.now() - recordingStartTime.value) / 1000)
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const seconds = (elapsed % 60).toString().padStart(2, '0')
  recordingDuration.value = `${minutes}:${seconds}`
}

/**
 * Start screen recording.
 * @param auto  true = started by auto-record (will auto-stop when typing ends);
 *              false = started manually (user must stop it themselves).
 */
async function startRecording(auto: boolean = false): Promise<boolean> {
  // If already recording, do nothing
  if (isRecording.value) return true

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as MediaTrackConstraints,
      audio: true,
    })
    mediaStream.value = stream

    // Detect user stopping screen share via browser UI
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
    recorder.start(100) // Collect data every 100ms
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

/** Toggle manual recording: start if not recording, stop if recording. */
async function toggleManualRecording() {
  if (isRecording.value) {
    stopRecordingAndDownload()
  } else {
    await startRecording(false)
  }
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

function stopRecordingAndDownload() {
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    mediaRecorder.value.stop() // This triggers onstop → downloadRecording
  } else {
    cleanupRecordingResources()
  }
}

/**
 * Auto-stop recording only if it was started via auto-record.
 * Called from typing completion / stop events. Manual recordings are unaffected.
 */
function autoStopRecordingIfNeeded() {
  if (isRecording.value && isAutoRecording.value && autoStopRecord.value) {
    stopRecordingAndDownload()
  }
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

// ==================== Keyboard Handling ====================
function handleGlobalKeydown(e: KeyboardEvent) {
  // Escape closes modal
  if (e.key === 'Escape' && showPasteModal.value) {
    closePasteModal()
    return
  }

  // Don't intercept if modal is open or focused on modal textarea
  if (showPasteModal.value) return

  // Manual mode: any key types the next chunk
  if (isTyping.value && typingMode.value === 'manual' && !typingComplete.value) {
    // Ignore modifier-only keys
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock'].includes(e.key)) return
    // Ignore Ctrl/Cmd combos (allow copy/paste etc)
    if (e.ctrlKey || e.metaKey) return

    e.preventDefault()
    typeManualChunk()
    return
  }

  // Auto mode: Space to toggle pause
  if (isTyping.value && typingMode.value === 'auto' && !typingComplete.value) {
    if (e.code === 'Space') {
      const active = document.activeElement
      if (active?.tagName !== 'TEXTAREA' && active?.tagName !== 'INPUT') {
        e.preventDefault()
        togglePause()
      }
    }
  }
}

// ==================== Lifecycle ====================
onMounted(() => {
  if (textareaRef.value) {
    textareaRef.value.focus()
  }
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
  document.removeEventListener('keydown', handleGlobalKeydown)
  // Clean up recording resources
  cleanupRecordingResources()
})
</script>

<template>
  <div class="code-display-container">
    <!-- Header Bar -->
    <header class="header-bar">
      <div class="header-left">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <span class="header-title">HTML Code Viewer</span>
      </div>
      <div class="header-right">
        <!-- Manual Record Button -->
        <button
          class="record-btn"
          :class="{ recording: isRecording }"
          @click="toggleManualRecording"
          :title="isRecording ? '停止录屏并下载' : '开始手动录屏'"
        >
          <span class="record-btn-dot" :class="{ active: isRecording }"></span>
          <span v-if="isRecording" class="record-btn-time">{{ recordingDuration }}</span>
          <span>{{ isRecording ? '停止录屏' : '录屏' }}</span>
        </button>

        <button class="typing-btn" @click="openPasteModal" :disabled="isTyping && !typingComplete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>模拟手打</span>
        </button>
        <span class="lang-badge">HTML</span>
        <span class="line-count">{{ lineNumbers.length }} lines</span>
      </div>
    </header>

    <!-- Typing Control Bar -->
    <div class="typing-control-bar" v-if="isTyping || typingComplete">
      <div class="control-left">
        <!-- Play/Pause (auto mode only) -->
        <button
          v-if="!typingComplete && typingMode === 'auto'"
          class="ctrl-btn"
          @click="togglePause"
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
        <button v-if="!typingComplete" class="ctrl-btn" @click="finishInstantly" title="立即完成">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <polygon points="5 3 19 12 5 21 5 3" />
            <rect x="18" y="3" width="3" height="18" rx="1" />
          </svg>
        </button>
        <!-- Stop -->
        <button class="ctrl-btn ctrl-btn-stop" @click="stopTyping" title="停止并清除">
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
            @click="switchMode('auto')"
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
            @click="switchMode('manual')"
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
            v-for="preset in (['slow', 'medium', 'fast'] as SpeedPreset[])"
            :key="preset"
            class="speed-preset-btn"
            :class="{ active: speedPreset === preset }"
            @click="speedPreset = preset"
          >
            {{ preset === 'slow' ? '慢' : preset === 'medium' ? '中' : '快' }}
          </button>
          <input
            type="range"
            min="5"
            max="250"
            :value="250 - typingSpeed"
            @input="typingSpeed = 250 - Number(($event.target as HTMLInputElement).value)"
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
            @click="manualCharsPerKey = n"
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
          <button class="ctrl-btn ctrl-btn-rec-stop" @click="stopRecordingAndDownload" title="停止录屏并下载">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        </div>

        <div class="progress-info">
          <span class="progress-text" v-if="isFrameworkMode">
            {{ frameworkTypedChars }} / {{ frameworkTotalChars }}
          </span>
          <span class="progress-text" v-else>{{ currentIndex }} / {{ targetCode.length }}</span>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: typingProgress + '%' }"></div>
          </div>
          <span class="progress-percent">{{ typingProgress }}%</span>
        </div>
      </div>
    </div>

    <!-- Editor Area -->
    <div class="editor-wrapper">
      <!-- Line Numbers -->
      <div class="line-numbers" ref="lineNumbersRef">
        <div v-for="num in lineNumbers" :key="num" class="line-num">{{ num }}</div>
      </div>

      <!-- Code Layers -->
      <div class="code-area">
        <pre
          ref="codeDisplayRef"
          class="code-highlight"
        ><code v-html="highlightedCode"></code></pre>

        <textarea
          ref="textareaRef"
          v-model="code"
          class="code-input"
          @scroll="syncScroll"
          @keydown="handleTab"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          :readonly="isTyping && !typingComplete"
          placeholder="点击右上角「模拟手打」按钮，粘贴代码开始模拟打字..."
        />
      </div>
    </div>

    <!-- Preview Panel -->
    <div class="preview-panel" :class="{ expanded: previewExpanded }">
      <div class="preview-header" @click="togglePreview">
        <div class="preview-header-left">
          <svg class="preview-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>Preview</span>
        </div>
        <button class="expand-btn" :title="previewExpanded ? 'Collapse' : 'Expand'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <template v-if="!previewExpanded">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </template>
            <template v-else>
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </template>
          </svg>
        </button>
      </div>
      <div class="preview-body">
        <iframe
          :srcdoc="code"
          sandbox="allow-scripts allow-modals"
          class="preview-iframe"
          title="HTML Preview"
        />
      </div>
    </div>

    <!-- Paste Modal -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showPasteModal" @click.self="closePasteModal">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title-group">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              <h3>粘贴要模拟输入的代码</h3>
            </div>
            <button class="modal-close" @click="closePasteModal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <textarea
              ref="pasteTextareaRef"
              v-model="pasteCode"
              class="paste-textarea"
              placeholder="在此粘贴代码...&#10;&#10;支持行尾添加特殊标记控制输入行为：&#10;  <!--[pause]-->  在此行暂停，等待手动继续&#10;  /*[pause]*/    CSS 注释风格&#10;  //[pause]      JS 注释风格&#10;  同理支持 [quick]（瞬间输入）和 [ignore]（跳过）&#10;&#10;框架模式 — 先展示骨架，再逐段输入：&#10;  <!--[slot]-->          默认顺序&#10;  /*[slot:2]*/           指定输入顺序&#10;  //[slot:nopause]       输入完不暂停&#10;  <!--[slot:1:nopause]--> 组合使用&#10;  <!--[/slot]-->         片段结束&#10;&#10;注释中间允许空格：&#10;  <!--  [slot]  -->   /*  [slot]  */   //  [slot]"
              spellcheck="false"
            />
            <!-- Action markers help -->
            <div class="action-help">
              <div class="action-help-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                行标记指令
              </div>
              <div class="action-help-items">
                <span class="action-tag tag-pause">&lt;!--[pause]--&gt;</span>
                <span class="action-desc">暂停输入</span>
                <span class="action-tag tag-quick">&lt;!--[quick]--&gt;</span>
                <span class="action-desc">瞬间输入整行</span>
                <span class="action-tag tag-ignore">&lt;!--[ignore]--&gt;</span>
                <span class="action-desc">跳过此行</span>
              </div>
              <div class="action-help-divider"></div>
              <div class="action-help-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
                框架模式
              </div>
              <div class="action-help-items">
                <span class="action-tag tag-slot">&lt;!--[slot]--&gt;</span>
                <span class="action-desc">代码片段起始（默认顺序）</span>
                <span class="action-tag tag-slot">&lt;!--[slot:2]--&gt;</span>
                <span class="action-desc">指定输入顺序（数字越小越先）</span>
                <span class="action-tag tag-slot-nopause">&lt;!--[slot:nopause]--&gt;</span>
                <span class="action-desc">输入完不暂停，直接下一段</span>
                <span class="action-tag tag-slot">&lt;!--[/slot]--&gt;</span>
                <span class="action-desc">代码片段结束</span>
              </div>
              <div class="action-help-note">
                框架（slot 外的代码）立即显示，片段（slot 内的代码）按顺序逐字输入
              </div>
              <div class="action-help-note">
                支持 &lt;!-- --&gt;、/* */、//、# 注释风格，注释与标记之间允许空格
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="modal-footer-left">
              <span class="char-count" v-if="pasteCode">
                {{ pasteCode.length }} 字符 · {{ pasteCode.split('\n').length }} 行
              </span>
            </div>
            <div class="modal-footer-right">
              <!-- Auto-record toggles -->
              <div class="record-toggles">
                <label class="record-toggle" title="模拟开始时自动录屏">
                  <input type="checkbox" v-model="autoRecord" class="record-toggle-input" />
                  <span class="record-toggle-track">
                    <span class="record-toggle-thumb"></span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="record-toggle-icon">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                  </svg>
                  <span class="record-toggle-label">自动录屏</span>
                </label>
                <label
                  v-if="autoRecord"
                  class="record-toggle record-toggle-sub"
                  title="模拟完成后自动停止录屏并下载；关闭则模拟完成后继续录制，需手动停止"
                >
                  <input type="checkbox" v-model="autoStopRecord" class="record-toggle-input" />
                  <span class="record-toggle-track">
                    <span class="record-toggle-thumb"></span>
                  </span>
                  <span class="record-toggle-label">完成自动停录</span>
                </label>
              </div>

              <!-- Mode selection in modal -->
              <div class="modal-mode-toggle">
                <button
                  class="modal-mode-btn"
                  :class="{ active: typingMode === 'auto' }"
                  @click="typingMode = 'auto'"
                >
                  自动模式
                </button>
                <button
                  class="modal-mode-btn"
                  :class="{ active: typingMode === 'manual' }"
                  @click="typingMode = 'manual'"
                >
                  手动模式
                </button>
              </div>
              <button class="modal-btn modal-btn-cancel" @click="closePasteModal">取消</button>
              <button
                class="modal-btn modal-btn-start"
                @click="startTyping"
                :disabled="!pasteCode.trim()"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                开始模拟
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.code-display-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
  color: #cdd6f4;
  overflow: hidden;
  position: relative;
}

/* Header */
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #181825;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 20px;
  height: 20px;
  color: #cba6f7;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #cdd6f4;
  font-family: system-ui, -apple-system, sans-serif;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Record Button (Header) */
.record-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid #313244;
  background: rgba(205, 214, 244, 0.05);
  color: #6c7086;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.record-btn:hover {
  background: rgba(243, 139, 168, 0.1);
  border-color: rgba(243, 139, 168, 0.3);
  color: #f38ba8;
}

.record-btn.recording {
  background: rgba(243, 139, 168, 0.12);
  border-color: rgba(243, 139, 168, 0.4);
  color: #f38ba8;
}

.record-btn.recording:hover {
  background: rgba(243, 139, 168, 0.2);
  border-color: rgba(243, 139, 168, 0.6);
}

.record-btn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6c7086;
  flex-shrink: 0;
  transition: background 0.2s;
}

.record-btn:hover .record-btn-dot {
  background: #f38ba8;
}

.record-btn-dot.active {
  background: #f38ba8;
  animation: recordingPulse 1.2s ease-in-out infinite;
}

.record-btn-time {
  font-size: 12px;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-weight: 600;
  color: #f38ba8;
  min-width: 36px;
}

.typing-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid rgba(203, 166, 247, 0.3);
  background: rgba(203, 166, 247, 0.1);
  color: #cba6f7;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
}

.typing-btn:hover:not(:disabled) {
  background: rgba(203, 166, 247, 0.2);
  border-color: rgba(203, 166, 247, 0.5);
}

.typing-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lang-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(203, 166, 247, 0.15);
  color: #cba6f7;
  font-family: system-ui, sans-serif;
}

.line-count {
  font-size: 12px;
  color: #6c7086;
  font-family: system-ui, sans-serif;
}

/* ==================== Typing Control Bar ==================== */
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

.typing-status.status-paused {
  color: #f9e2af;
}

.typing-status.status-complete {
  color: #89b4fa;
}

.typing-status.status-manual {
  color: #f5c2e7;
}

.control-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

/* Mode Toggle */
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

.mode-btn:first-child {
  border-right: 1px solid #313244;
}

.mode-btn.active {
  background: rgba(203, 166, 247, 0.15);
  color: #cba6f7;
}

.mode-btn:hover:not(.active) {
  background: rgba(205, 214, 244, 0.05);
  color: #a6adc8;
}

/* Speed Presets */
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

.speed-preset-btn:hover:not(.active) {
  background: rgba(205, 214, 244, 0.05);
  color: #a6adc8;
}

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

/* Progress */
.control-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-text {
  font-size: 11px;
  color: #6c7086;
  font-family: ui-monospace, 'SF Mono', monospace;
  white-space: nowrap;
}

.progress-bar {
  width: 100px;
  height: 4px;
  background: #313244;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #cba6f7, #89b4fa);
  border-radius: 2px;
  transition: width 0.15s ease;
}

.progress-percent {
  font-size: 12px;
  font-weight: 600;
  color: #89b4fa;
  font-family: system-ui, sans-serif;
  min-width: 36px;
  text-align: right;
}

/* Editor */
.editor-wrapper {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.line-numbers {
  width: 56px;
  flex-shrink: 0;
  padding: 16px 0;
  background: #181825;
  border-right: 1px solid #313244;
  overflow: hidden;
  user-select: none;
}

.line-num {
  height: 22px;
  line-height: 22px;
  font-size: 13px;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  color: #45475a;
  text-align: right;
  padding-right: 16px;
}

.code-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.code-highlight,
.code-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 16px;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 14px;
  line-height: 22px;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  box-sizing: border-box;
}

.code-highlight {
  background: transparent;
  pointer-events: none;
  z-index: 1;
  color: #cdd6f4;
}

.code-highlight code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  background: none;
  padding: 0;
}

.code-input {
  background: transparent;
  color: transparent;
  caret-color: #f5e0dc;
  border: none;
  outline: none;
  resize: none;
  z-index: 2;
  -webkit-text-fill-color: transparent;
}

.code-input::selection {
  background: rgba(203, 166, 247, 0.2);
  -webkit-text-fill-color: transparent;
}

.code-input::placeholder {
  -webkit-text-fill-color: #45475a;
  color: #45475a;
}

/* Preview Panel */
.preview-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  height: 280px;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-panel.expanded {
  width: 60vw;
  height: 70vh;
  bottom: 15vh;
  right: 20vw;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #181825;
  border-bottom: 1px solid #313244;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.preview-header:hover {
  background: #1e1e2e;
}

.preview-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #a6e3a1;
  font-family: system-ui, sans-serif;
}

.preview-icon {
  width: 16px;
  height: 16px;
  color: #a6e3a1;
}

.expand-btn {
  background: none;
  border: none;
  color: #6c7086;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.expand-btn:hover {
  color: #cdd6f4;
  background: rgba(205, 214, 244, 0.1);
}

.preview-body {
  flex: 1;
  overflow: hidden;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* ==================== Paste Modal ==================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  width: 720px;
  max-width: 90vw;
  max-height: 85vh;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid #313244;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #cba6f7;
}

.modal-title-group h3 {
  font-size: 16px;
  font-weight: 700;
  color: #cdd6f4;
  font-family: system-ui, sans-serif;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #6c7086;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close:hover {
  background: rgba(243, 139, 168, 0.1);
  color: #f38ba8;
}

.modal-body {
  flex: 1;
  padding: 16px 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.paste-textarea {
  width: 100%;
  height: 280px;
  background: #11111b;
  border: 1px solid #313244;
  border-radius: 10px;
  padding: 16px;
  color: #cdd6f4;
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 20px;
  resize: none;
  outline: none;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  transition: border-color 0.2s;
}

.paste-textarea:focus {
  border-color: rgba(203, 166, 247, 0.5);
}

.paste-textarea::placeholder {
  color: #45475a;
}

/* Action Markers Help */
.action-help {
  padding: 10px 14px;
  background: rgba(203, 166, 247, 0.04);
  border: 1px solid rgba(203, 166, 247, 0.1);
  border-radius: 8px;
}

.action-help-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #a6adc8;
  font-family: system-ui, sans-serif;
  margin-bottom: 8px;
}

.action-help-items {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  align-items: center;
}

.action-tag {
  font-size: 11px;
  font-family: ui-monospace, 'SF Mono', monospace;
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-pause {
  background: rgba(249, 226, 175, 0.1);
  color: #f9e2af;
}

.tag-quick {
  background: rgba(166, 227, 161, 0.1);
  color: #a6e3a1;
}

.tag-ignore {
  background: rgba(108, 112, 134, 0.15);
  color: #6c7086;
}

.tag-slot {
  background: rgba(137, 180, 250, 0.1);
  color: #89b4fa;
}

.tag-slot-nopause {
  background: rgba(148, 226, 213, 0.1);
  color: #94e2d5;
}

.action-help-divider {
  height: 1px;
  background: rgba(203, 166, 247, 0.08);
  margin: 8px 0;
}

.action-help-note {
  font-size: 11px;
  color: #585b70;
  font-family: system-ui, sans-serif;
  margin-top: 4px;
  line-height: 1.4;
}

.action-desc {
  font-size: 12px;
  color: #6c7086;
  font-family: system-ui, sans-serif;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid #313244;
  gap: 12px;
}

.modal-footer-left {
  display: flex;
  align-items: center;
}

.char-count {
  font-size: 12px;
  color: #6c7086;
  font-family: system-ui, sans-serif;
}

.modal-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Modal Mode Toggle */
.modal-mode-toggle {
  display: flex;
  border-radius: 8px;
  border: 1px solid #313244;
  overflow: hidden;
}

.modal-mode-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  border: none;
  background: transparent;
  color: #6c7086;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-mode-btn:first-child {
  border-right: 1px solid #313244;
}

.modal-mode-btn.active {
  background: rgba(203, 166, 247, 0.12);
  color: #cba6f7;
}

.modal-mode-btn:hover:not(.active) {
  background: rgba(205, 214, 244, 0.05);
}

.modal-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-btn-cancel {
  background: rgba(205, 214, 244, 0.05);
  color: #6c7086;
  border: 1px solid #313244;
}

.modal-btn-cancel:hover {
  background: rgba(205, 214, 244, 0.1);
  color: #cdd6f4;
}

.modal-btn-start {
  background: linear-gradient(135deg, #cba6f7, #89b4fa);
  color: #11111b;
}

.modal-btn-start:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 16px rgba(203, 166, 247, 0.3);
}

.modal-btn-start:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ==================== Recording Toggle (Modal) ==================== */
.record-toggles {
  display: flex;
  align-items: center;
  gap: 6px;
}

.record-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid #313244;
  transition: all 0.2s;
}

.record-toggle:hover {
  border-color: rgba(243, 139, 168, 0.3);
  background: rgba(243, 139, 168, 0.05);
}

.record-toggle-input {
  display: none;
}

.record-toggle-track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 8px;
  background: #313244;
  transition: background 0.2s;
  flex-shrink: 0;
}

.record-toggle-input:checked + .record-toggle-track {
  background: rgba(243, 139, 168, 0.4);
}

.record-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6c7086;
  transition: all 0.2s;
}

.record-toggle-input:checked + .record-toggle-track .record-toggle-thumb {
  left: 14px;
  background: #f38ba8;
}

.record-toggle-icon {
  color: #6c7086;
  transition: color 0.2s;
  flex-shrink: 0;
}

.record-toggle-input:checked ~ .record-toggle-icon {
  color: #f38ba8;
}

.record-toggle-label {
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  color: #6c7086;
  white-space: nowrap;
  transition: color 0.2s;
}

.record-toggle-input:checked ~ .record-toggle-label {
  color: #f38ba8;
}

.record-toggle-sub {
  border-style: dashed;
  animation: fadeIn 0.2s ease;
}

.record-toggle-sub .record-toggle-input:checked + .record-toggle-track {
  background: rgba(166, 227, 161, 0.4);
}

.record-toggle-sub .record-toggle-input:checked + .record-toggle-track .record-toggle-thumb {
  background: #a6e3a1;
}

.record-toggle-sub .record-toggle-input:checked ~ .record-toggle-label {
  color: #a6e3a1;
}

.record-toggle-sub:hover {
  border-color: rgba(166, 227, 161, 0.3);
  background: rgba(166, 227, 161, 0.05);
}

/* ==================== Recording Indicator (Control Bar) ==================== */
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

/* Scrollbar styling */
.code-highlight::-webkit-scrollbar,
.code-input::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.code-highlight::-webkit-scrollbar-track,
.code-input::-webkit-scrollbar-track {
  background: transparent;
}

.code-highlight::-webkit-scrollbar-thumb,
.code-input::-webkit-scrollbar-thumb {
  background: #313244;
  border-radius: 4px;
}

.code-highlight::-webkit-scrollbar-thumb:hover,
.code-input::-webkit-scrollbar-thumb:hover {
  background: #45475a;
}

.paste-textarea::-webkit-scrollbar {
  width: 6px;
}

.paste-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.paste-textarea::-webkit-scrollbar-thumb {
  background: #313244;
  border-radius: 3px;
}

/* Responsive */
@media (max-width: 768px) {
  .preview-panel {
    width: calc(100vw - 32px);
    height: 240px;
    bottom: 16px;
    right: 16px;
  }

  .preview-panel.expanded {
    width: calc(100vw - 32px);
    height: 60vh;
    bottom: 16px;
    right: 16px;
  }

  .line-numbers {
    width: 44px;
  }

  .line-num {
    font-size: 12px;
    padding-right: 12px;
  }

  .typing-control-bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }

  .speed-slider {
    width: 60px;
  }

  .progress-bar {
    width: 60px;
  }

  .modal-content {
    width: 95vw;
    max-height: 90vh;
  }

  .paste-textarea {
    height: 200px;
  }

  .action-help-items {
    grid-template-columns: 1fr;
  }
}
</style>
