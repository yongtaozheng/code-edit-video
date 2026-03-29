import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue'
import type { FrameworkSlot } from '../types'

export function useEditorScroll(options: {
  code: Ref<string>
  isFrameworkMode: Ref<boolean>
  currentSlotIndex: Ref<number>
  slotExecOrder: Ref<number[]>
  frameworkSlots: Ref<FrameworkSlot[]>
  currentSlotCharIndex: Ref<number>
  lineHeight?: ComputedRef<number>
}) {
  const { code, isFrameworkMode, currentSlotIndex, slotExecOrder, frameworkSlots, currentSlotCharIndex } = options

  const textareaRef = ref<HTMLTextAreaElement | null>(null)
  const codeDisplayRef = ref<HTMLElement | null>(null)
  const lineNumbersRef = ref<HTMLElement | null>(null)

  const lineNumbers = computed(() => {
    const lines = code.value.split('\n')
    return lines.map((_: string, i: number) => i + 1)
  })

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

  function scrollToCursor() {
    nextTick(() => {
      let targetLine: number

      if (isFrameworkMode.value && currentSlotIndex.value < slotExecOrder.value.length) {
        const currentCode = code.value
        const actualSlotIdx = slotExecOrder.value[currentSlotIndex.value]
        const slot = frameworkSlots.value[actualSlotIdx]
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

      const lineHeight = options.lineHeight?.value ?? 22
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

  return {
    textareaRef,
    codeDisplayRef,
    lineNumbersRef,
    lineNumbers,
    syncScroll,
    handleTab,
    scrollToCursor,
  }
}
