import { ref, computed, watch, type Ref } from 'vue'
import type { TypingMode, SpeedPreset, LineAction, FrameworkSlot } from '../types'
import { parseAndCleanCode, getActionAtIndex, parseFrameworkCode, computeSlotExecOrder } from '../utils/codeParser'

export function useTypingEngine(options: {
  code: Ref<string>
  onTypingComplete: () => void
  scrollToCursor: () => void
  onSaveRequested?: () => void
}) {
  const { code } = options

  // Typing state
  const targetCode = ref('')
  const rawTargetCode = ref('')
  const currentIndex = ref(0)
  const isTyping = ref(false)
  const isPaused = ref(false)
  const typingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const typingComplete = ref(false)
  const typingError = ref('')

  const typingMode = ref<TypingMode>('auto')
  const speedPreset = ref<SpeedPreset>('fast')
  const typingSpeed = ref(30)
  const manualCharsPerKey = ref(1)
  const lineActions = ref<LineAction[]>([])

  // Framework mode state
  const isFrameworkMode = ref(false)
  const frameworkBase = ref('')
  const frameworkSlots = ref<FrameworkSlot[]>([])
  const slotExecOrder = ref<number[]>([])
  const currentSlotIndex = ref(0)
  const currentSlotCharIndex = ref(0)

  // Speed preset mapping
  const speedPresetMap: Record<SpeedPreset, number> = {
    slow: 150,
    medium: 80,
    fast: 30,
  }

  watch(speedPreset, (preset) => {
    typingSpeed.value = speedPresetMap[preset]
  })

  // ==================== Computed Properties ====================

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

  const cursorPositionInCode = computed((): number => {
    if (typingComplete.value) return -1
    if (!isTyping.value && !isPaused.value) return -1

    if (isFrameworkMode.value) {
      const execOrder = slotExecOrder.value
      if (currentSlotIndex.value >= execOrder.length) return -1

      const actualSlotIdx = execOrder[currentSlotIndex.value]
      const slot = frameworkSlots.value[actualSlotIdx]

      let pos = slot.insertPosition

      const completedSlots = new Set<number>()
      for (let e = 0; e < currentSlotIndex.value; e++) {
        completedSlots.add(execOrder[e])
      }
      for (let si = 0; si < frameworkSlots.value.length; si++) {
        if (si !== actualSlotIdx &&
            frameworkSlots.value[si].insertPosition <= slot.insertPosition &&
            completedSlots.has(si)) {
          pos += frameworkSlots.value[si].content.length
        }
      }

      pos += currentSlotCharIndex.value
      return pos
    }

    return currentIndex.value
  })

  // ==================== Build Code From Slots ====================

  function buildCodeFromSlots(): string {
    let result = ''
    let frameworkPos = 0
    const fw = frameworkBase.value
    const slots = frameworkSlots.value
    const execOrder = slotExecOrder.value
    const currentExecStep = currentSlotIndex.value
    const currentActualIdx = currentExecStep < execOrder.length ? execOrder[currentExecStep] : -1

    const completedSlots = new Set<number>()
    for (let e = 0; e < currentExecStep; e++) {
      completedSlots.add(execOrder[e])
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      result += fw.substring(frameworkPos, slot.insertPosition)
      frameworkPos = slot.insertPosition

      if (completedSlots.has(i)) {
        result += slot.content
      } else if (i === currentActualIdx) {
        const typedContent = slot.content.substring(0, currentSlotCharIndex.value)
        result += typedContent

        if (
          typedContent.length > 0 &&
          typedContent.length < slot.content.length &&
          !typedContent.endsWith('\n') &&
          fw.length > slot.insertPosition &&
          fw.charAt(slot.insertPosition) !== '\n'
        ) {
          result += '\n'
        }
      }
    }

    result += fw.substring(frameworkPos)
    return result
  }

  // ==================== Typing Simulation Engine ====================

  function getRandomDelay(char: string, nextChar: string): number {
    const base = typingSpeed.value
    let delay = base * (0.5 + Math.random())

    if (Math.random() < 0.1) {
      delay += base * 2.5
    }

    if (char === '\n') return delay * 2.2
    if (char === '>' || char === ';' || char === '}' || char === ')') return delay * 1.4
    if (char === ' ' && nextChar === ' ') return delay * 0.2
    if (char === '<' || char === '{' || char === '(') return delay * 1.2
    if (char === '=' || char === ':') return delay * 0.8

    return delay
  }

  function triggerSaveIfNeeded() {
    options.onSaveRequested?.()
  }

  function hasSaveActionAtLineEnd(index: number): boolean {
    return lineActions.value.some((a) => a.type === 'save' && a.lineEnd === index)
  }

  function isCssSlot(actualSlotIdx: number): boolean {
    const slot = frameworkSlots.value[actualSlotIdx]
    if (!slot) return false
    const before = frameworkBase.value.substring(0, slot.insertPosition).toLowerCase()
    const openCount = (before.match(/<style\b[^>]*>/g) || []).length
    const closeCount = (before.match(/<\/style>/g) || []).length
    return openCount > closeCount
  }

  function typeNextChar() {
    if (isFrameworkMode.value) {
      typeNextSlotChar()
      return
    }

    if (!isTyping.value || isPaused.value) return
    if (currentIndex.value >= targetCode.value.length) {
      isTyping.value = false
      typingComplete.value = true
      options.onTypingComplete()
      return
    }

    const action = getActionAtIndex(currentIndex.value, lineActions.value)
    if (action) {
      if (action.type === 'pause') {
        isPaused.value = true
        return
      }
      if (action.type === 'quick') {
        const lineContent = targetCode.value.substring(action.lineStart, action.lineEnd + 1)
        code.value += lineContent
        currentIndex.value = action.lineEnd + 1
        options.scrollToCursor()
        typingTimer.value = setTimeout(typeNextChar, 50)
        return
      }
    }

    const typedIndex = currentIndex.value
    const char = targetCode.value[currentIndex.value]
    code.value += char
    currentIndex.value++

    // 换行后，将下一行的前导空格一次性输入
    if (char === '\n') {
      let leadingSpaces = ''
      while (
        currentIndex.value < targetCode.value.length &&
        (targetCode.value[currentIndex.value] === ' ' || targetCode.value[currentIndex.value] === '\t')
      ) {
        leadingSpaces += targetCode.value[currentIndex.value]
        currentIndex.value++
      }
      if (leadingSpaces) {
        code.value += leadingSpaces
      }
    }

    const nextChar = targetCode.value[currentIndex.value] || ''

    if (hasSaveActionAtLineEnd(typedIndex)) {
      triggerSaveIfNeeded()
    }

    options.scrollToCursor()

    const delay = getRandomDelay(char, nextChar)
    typingTimer.value = setTimeout(typeNextChar, delay)
  }

  function typeNextSlotChar() {
    if (!isTyping.value || isPaused.value) return

    const execOrder = slotExecOrder.value
    if (currentSlotIndex.value >= execOrder.length) {
      isTyping.value = false
      typingComplete.value = true
      options.onTypingComplete()
      return
    }

    const actualSlotIdx = execOrder[currentSlotIndex.value]
    const currentSlot = frameworkSlots.value[actualSlotIdx]

    if (currentSlotCharIndex.value >= currentSlot.content.length) {
      const justFinished = currentSlot
      currentSlotIndex.value++
      currentSlotCharIndex.value = 0

      if (currentSlotIndex.value >= execOrder.length) {
        isTyping.value = false
        typingComplete.value = true
        code.value = buildCodeFromSlots()
        options.scrollToCursor()
        triggerSaveIfNeeded()
        options.onTypingComplete()
        return
      }

      code.value = buildCodeFromSlots()
      options.scrollToCursor()
      triggerSaveIfNeeded()

      if (justFinished.pauseAfter) {
        isPaused.value = true
        return
      }

      typingTimer.value = setTimeout(typeNextSlotChar, 50)
      return
    }

    const char = currentSlot.content[currentSlotCharIndex.value]
    currentSlotCharIndex.value++

    // 换行后，将下一行的前导空格一次性输入
    if (char === '\n') {
      while (
        currentSlotCharIndex.value < currentSlot.content.length &&
        (currentSlot.content[currentSlotCharIndex.value] === ' ' || currentSlot.content[currentSlotCharIndex.value] === '\t')
      ) {
        currentSlotCharIndex.value++
      }
    }

    const nextChar = currentSlot.content[currentSlotCharIndex.value] || ''

    code.value = buildCodeFromSlots()
    options.scrollToCursor()
    if (char === '}' && isCssSlot(actualSlotIdx)) {
      triggerSaveIfNeeded()
    }

    const delay = getRandomDelay(char, nextChar)
    typingTimer.value = setTimeout(typeNextSlotChar, delay)
  }

  function typeManualChunk() {
    if (isFrameworkMode.value) {
      typeManualSlotChunk()
      return
    }

    if (!isTyping.value || typingComplete.value) return

    if (isPaused.value) {
      isPaused.value = false
    }

    const charsToType = manualCharsPerKey.value

    for (let i = 0; i < charsToType; i++) {
      if (currentIndex.value >= targetCode.value.length) {
        isTyping.value = false
        typingComplete.value = true
        options.onTypingComplete()
        break
      }

      const action = getActionAtIndex(currentIndex.value, lineActions.value)
      if (action) {
        if (action.type === 'pause') {
          // In manual mode, a keypress at a [pause] line resumes and starts the line
        }
        if (action.type === 'quick') {
          const lineContent = targetCode.value.substring(action.lineStart, action.lineEnd + 1)
          code.value += lineContent
          currentIndex.value = action.lineEnd + 1
          options.scrollToCursor()
          return
        }
      }

      const typedIndex = currentIndex.value
      const char = targetCode.value[currentIndex.value]
      code.value += char
      currentIndex.value++

      // 换行后，将下一行的前导空格一次性输入（不计入本次按键字符数）
      if (char === '\n') {
        let leadingSpaces = ''
        while (
          currentIndex.value < targetCode.value.length &&
          (targetCode.value[currentIndex.value] === ' ' || targetCode.value[currentIndex.value] === '\t')
        ) {
          leadingSpaces += targetCode.value[currentIndex.value]
          currentIndex.value++
        }
        if (leadingSpaces) {
          code.value += leadingSpaces
        }
      }

      if (hasSaveActionAtLineEnd(typedIndex)) {
        triggerSaveIfNeeded()
      }
    }

    options.scrollToCursor()
  }

  function typeManualSlotChunk() {
    if (!isTyping.value || typingComplete.value) return

    const execOrder = slotExecOrder.value
    if (currentSlotIndex.value >= execOrder.length) {
      isTyping.value = false
      typingComplete.value = true
      options.onTypingComplete()
      return
    }

    if (isPaused.value) {
      isPaused.value = false
    }

    const charsToType = manualCharsPerKey.value
    let shouldSaveAfterBuild = false

    for (let i = 0; i < charsToType; i++) {
      if (currentSlotIndex.value >= execOrder.length) {
        isTyping.value = false
        typingComplete.value = true
        options.onTypingComplete()
        break
      }

      const actualSlotIdx = execOrder[currentSlotIndex.value]
      const currentSlot = frameworkSlots.value[actualSlotIdx]

      if (currentSlotCharIndex.value >= currentSlot.content.length) {
        const justFinished = currentSlot
        currentSlotIndex.value++
        currentSlotCharIndex.value = 0

        if (currentSlotIndex.value >= execOrder.length) {
          isTyping.value = false
          typingComplete.value = true
          shouldSaveAfterBuild = true
          options.onTypingComplete()
          break
        }

        shouldSaveAfterBuild = true
        if (justFinished.pauseAfter) {
          isPaused.value = true
          break
        }
        continue
      }

      currentSlotCharIndex.value++
      const char = currentSlot.content[currentSlotCharIndex.value - 1]

      // 换行后，将下一行的前导空格一次性输入（不计入本次按键字符数）
      if (char === '\n') {
        while (
          currentSlotCharIndex.value < currentSlot.content.length &&
          (currentSlot.content[currentSlotCharIndex.value] === ' ' || currentSlot.content[currentSlotCharIndex.value] === '\t')
        ) {
          currentSlotCharIndex.value++
        }
      }

      if (char === '}' && isCssSlot(actualSlotIdx)) {
        shouldSaveAfterBuild = true
      }
    }

    code.value = buildCodeFromSlots()
    options.scrollToCursor()
    if (shouldSaveAfterBuild) {
      triggerSaveIfNeeded()
    }
  }

  // ==================== Control Functions ====================

  function startTyping(pasteCode: string) {
    if (!pasteCode.trim()) return

    // Clear any previous error
    typingError.value = ''

    let parsed: ReturnType<typeof parseFrameworkCode>
    try {
      parsed = parseFrameworkCode(pasteCode)
    } catch (e) {
      console.error('[useTypingEngine] parseFrameworkCode failed:', e)
      typingError.value = '代码解析失败：插槽标记格式有误，请检查 [slot] / [/slot] 标记是否正确'
      return
    }

    const { framework, slots, hasSlots } = parsed

    if (hasSlots) {
      isFrameworkMode.value = true
      frameworkBase.value = framework
      frameworkSlots.value = slots
      slotExecOrder.value = computeSlotExecOrder(slots)
      currentSlotIndex.value = 0
      currentSlotCharIndex.value = 0

      rawTargetCode.value = pasteCode
      targetCode.value = ''
      lineActions.value = []
      currentIndex.value = 0

      try {
        code.value = buildCodeFromSlots()
      } catch (e) {
        console.error('[useTypingEngine] buildCodeFromSlots failed:', e)
        typingError.value = '代码构建失败：插槽内容拼接出错，请检查代码格式'
        return
      }

      isTyping.value = true
      isPaused.value = false
      typingComplete.value = false

      if (typingMode.value === 'auto') {
        typingTimer.value = setTimeout(typeNextSlotChar, 500)
      }
    } else {
      isFrameworkMode.value = false
      frameworkBase.value = ''
      frameworkSlots.value = []
      slotExecOrder.value = []

      let cleanResult: ReturnType<typeof parseAndCleanCode>
      try {
        cleanResult = parseAndCleanCode(pasteCode)
      } catch (e) {
        console.error('[useTypingEngine] parseAndCleanCode failed:', e)
        typingError.value = '代码解析失败：行标记格式有误，请检查 [pause] / [quick] / [save] / [ignore] 标记'
        return
      }

      rawTargetCode.value = pasteCode
      targetCode.value = cleanResult.cleanCode
      lineActions.value = cleanResult.actions
      currentIndex.value = 0
      code.value = ''
      isTyping.value = true
      isPaused.value = false
      typingComplete.value = false

      if (typingMode.value === 'auto') {
        typingTimer.value = setTimeout(typeNextChar, 500)
      }
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
    isFrameworkMode.value = false
    frameworkBase.value = ''
    frameworkSlots.value = []
    slotExecOrder.value = []
    currentSlotIndex.value = 0
    currentSlotCharIndex.value = 0
    options.onTypingComplete()
  }

  function finishInstantly() {
    if (typingTimer.value) {
      clearTimeout(typingTimer.value)
      typingTimer.value = null
    }

    if (isFrameworkMode.value) {
      currentSlotIndex.value = slotExecOrder.value.length
      currentSlotCharIndex.value = 0
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
    options.scrollToCursor()
    options.onTypingComplete()
  }

  function switchMode(mode: TypingMode) {
    if (typingMode.value === mode) return
    typingMode.value = mode

    if (isTyping.value && !isPaused.value && !typingComplete.value) {
      if (mode === 'auto') {
        if (isFrameworkMode.value) {
          typeNextSlotChar()
        } else {
          typeNextChar()
        }
      } else {
        if (typingTimer.value) {
          clearTimeout(typingTimer.value)
          typingTimer.value = null
        }
      }
    }
  }

  // Watch speed changes
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

  function cleanup() {
    if (typingTimer.value) {
      clearTimeout(typingTimer.value)
    }
  }

  return {
    // State
    targetCode,
    rawTargetCode,
    currentIndex,
    isTyping,
    isPaused,
    typingComplete,
    typingError,
    typingMode,
    speedPreset,
    typingSpeed,
    manualCharsPerKey,
    lineActions,

    // Framework mode state
    isFrameworkMode,
    frameworkBase,
    frameworkSlots,
    slotExecOrder,
    currentSlotIndex,
    currentSlotCharIndex,

    // Computed
    frameworkTypedChars,
    frameworkTotalChars,
    typingProgress,
    typingStatusText,
    cursorPositionInCode,

    // Actions
    startTyping,
    pauseTyping,
    resumeTyping,
    togglePause,
    stopTyping,
    finishInstantly,
    switchMode,
    typeManualChunk,

    // Cleanup
    cleanup,
  }
}
