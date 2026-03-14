import { ref, computed, watch } from 'vue'
import { splitCodeForCodePen } from '../utils/codeSplitter'

export function useSlotConfig(options: {
  onUseCode: (code: string) => void
}) {
  const showSlotConfigModal = ref(false)
  const slotConfigInput = ref('')
  const slotConfigParsedHTML = ref('')
  const slotConfigParsedCSS = ref('')
  const slotConfigParsedJS = ref('')
  const slotConfigOrder = ref<('html' | 'css' | 'js')[]>(['html', 'css', 'js'])
  const slotConfigPauseBetween = ref(true)
  const slotConfigDragging = ref<'html' | 'css' | 'js' | null>(null)
  const slotConfigDragOver = ref<'html' | 'css' | 'js' | null>(null)
  const slotConfigCopied = ref(false)

  function openSlotConfigModal() {
    slotConfigInput.value = ''
    slotConfigParsedHTML.value = ''
    slotConfigParsedCSS.value = ''
    slotConfigParsedJS.value = ''
    slotConfigOrder.value = ['html', 'css', 'js']
    slotConfigPauseBetween.value = true
    slotConfigDragging.value = null
    slotConfigDragOver.value = null
    slotConfigCopied.value = false
    showSlotConfigModal.value = true
  }

  function closeSlotConfigModal() {
    showSlotConfigModal.value = false
    slotConfigDragging.value = null
    slotConfigDragOver.value = null
  }

  function parseSlotConfigInput() {
    const src = slotConfigInput.value
    if (!src.trim()) {
      slotConfigParsedHTML.value = ''
      slotConfigParsedCSS.value = ''
      slotConfigParsedJS.value = ''
      return
    }
    const result = splitCodeForCodePen(src)
    slotConfigParsedHTML.value = result.html
    slotConfigParsedCSS.value = result.css
    slotConfigParsedJS.value = result.js
  }

  // Auto-parse when input changes
  watch(slotConfigInput, () => {
    parseSlotConfigInput()
    slotConfigCopied.value = false
  })

  function onSlotConfigDragStart(e: DragEvent, type: 'html' | 'css' | 'js') {
    slotConfigDragging.value = type
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', type)
    }
  }

  function onSlotConfigDragEnd() {
    slotConfigDragging.value = null
    slotConfigDragOver.value = null
  }

  function onSlotConfigDragEnter(type: 'html' | 'css' | 'js') {
    if (slotConfigDragging.value && slotConfigDragging.value !== type) {
      slotConfigDragOver.value = type
    }
  }

  function onSlotConfigDragLeave(e: DragEvent, type: 'html' | 'css' | 'js') {
    const related = e.relatedTarget as HTMLElement | null
    const target = e.currentTarget as HTMLElement
    if (!related || !target.contains(related)) {
      if (slotConfigDragOver.value === type) {
        slotConfigDragOver.value = null
      }
    }
  }

  function onSlotConfigDrop(e: DragEvent, targetType: 'html' | 'css' | 'js') {
    e.preventDefault()
    const dragged = slotConfigDragging.value
    if (!dragged || dragged === targetType) return
    const order = [...slotConfigOrder.value]
    const fromIdx = order.indexOf(dragged)
    const toIdx = order.indexOf(targetType)
    order.splice(fromIdx, 1)
    order.splice(toIdx, 0, dragged)
    slotConfigOrder.value = order
    slotConfigDragging.value = null
    slotConfigDragOver.value = null
  }

  function moveSlotConfig(type: 'html' | 'css' | 'js', direction: 'up' | 'down') {
    const order = [...slotConfigOrder.value]
    const idx = order.indexOf(type)
    if (direction === 'up' && idx > 0) {
      ;[order[idx - 1], order[idx]] = [order[idx], order[idx - 1]]
    } else if (direction === 'down' && idx < order.length - 1) {
      ;[order[idx + 1], order[idx]] = [order[idx], order[idx + 1]]
    }
    slotConfigOrder.value = order
  }

  function getSlotConfigParsed(type: 'html' | 'css' | 'js'): string {
    switch (type) {
      case 'html': return slotConfigParsedHTML.value
      case 'css': return slotConfigParsedCSS.value
      case 'js': return slotConfigParsedJS.value
    }
  }

  const slotConfigHasParsed = computed(() => {
    return !!(slotConfigParsedHTML.value.trim() || slotConfigParsedCSS.value.trim() || slotConfigParsedJS.value.trim())
  })

  const slotConfigStats = computed(() => {
    const stats: { type: string; chars: number; lines: number }[] = []
    if (slotConfigParsedHTML.value.trim()) stats.push({ type: 'HTML', chars: slotConfigParsedHTML.value.length, lines: slotConfigParsedHTML.value.split('\n').length })
    if (slotConfigParsedCSS.value.trim()) stats.push({ type: 'CSS', chars: slotConfigParsedCSS.value.length, lines: slotConfigParsedCSS.value.split('\n').length })
    if (slotConfigParsedJS.value.trim()) stats.push({ type: 'JS', chars: slotConfigParsedJS.value.length, lines: slotConfigParsedJS.value.split('\n').length })
    return stats
  })

  const slotConfigGenerated = computed((): string => {
    const src = slotConfigInput.value
    if (!src.trim() || !slotConfigHasParsed.value) return ''

    const order = slotConfigOrder.value
    const hasCSS = !!slotConfigParsedCSS.value.trim()
    const hasJS = !!slotConfigParsedJS.value.trim()
    const hasHTML = !!slotConfigParsedHTML.value.trim()
    const pauseStr = slotConfigPauseBetween.value ? '' : ':nopause'

    const activeOrder = order.filter(type =>
      type === 'html' ? hasHTML : type === 'css' ? hasCSS : hasJS
    )
    const orderMap: Record<string, number> = {}
    activeOrder.forEach((type, idx) => {
      orderMap[type] = idx
    })

    if (activeOrder.length === 0) return src

    let result = src

    // 1. Insert CSS slot markers inside <style> tags
    if (hasCSS && orderMap['css'] !== undefined) {
      const styleRe = new RegExp('(<' + 'style' + '[^>]*>)([\\s\\S]*?)(</' + 'style>)', 'gi')
      result = result.replace(styleRe, (_match, open: string, content: string, close: string) => {
        const trimmed = content.trim()
        if (!trimmed) return _match
        const cleanContent = content.replace(/^\n+/, '').replace(/\n+$/, '')
        return `${open}\n/*[slot:${orderMap['css']}${pauseStr}]*/\n${cleanContent}\n/*[/slot]*/\n${close}`
      })
    }

    // 2. Insert JS slot markers inside <script> tags
    if (hasJS && orderMap['js'] !== undefined) {
      const scriptRe = new RegExp('(<' + 'script' + '[^>]*>)([\\s\\S]*?)(</' + 'script>)', 'gi')
      result = result.replace(scriptRe, (_match, open: string, content: string, close: string) => {
        const trimmed = content.trim()
        if (!trimmed) return _match
        const cleanContent = content.replace(/^\n+/, '').replace(/\n+$/, '')
        return `${open}\n//[slot:${orderMap['js']}${pauseStr}]\n${cleanContent}\n//[/slot]\n${close}`
      })
    }

    // 3. Insert HTML slot markers around body content
    if (hasHTML && orderMap['html'] !== undefined) {
      const bodyOpenRe = new RegExp('(<' + 'body' + '[^>]*>)', 'i')
      const bodyCloseRe = new RegExp('(</' + 'body>)', 'i')
      const bodyOpenMatch = bodyOpenRe.exec(result)
      const bodyCloseMatch = bodyCloseRe.exec(result)

      if (bodyOpenMatch && bodyCloseMatch) {
        const bodyStart = bodyOpenMatch.index + bodyOpenMatch[0].length
        const bodyEnd = bodyCloseMatch.index
        const bodyContent = result.substring(bodyStart, bodyEnd)

        const scriptStyleRe = new RegExp('<' + '(?:script|style)' + '[^>]*>[\\s\\S]*?</' + '(?:script|style)>', 'gi')
        const nonTagRegions: { start: number; end: number }[] = []
        let lastEnd = 0
        let m: RegExpExecArray | null
        scriptStyleRe.lastIndex = 0
        while ((m = scriptStyleRe.exec(bodyContent)) !== null) {
          if (m.index > lastEnd) {
            const segment = bodyContent.substring(lastEnd, m.index)
            if (segment.trim()) {
              nonTagRegions.push({ start: lastEnd, end: m.index })
            }
          }
          lastEnd = m.index + m[0].length
        }
        if (lastEnd < bodyContent.length) {
          const segment = bodyContent.substring(lastEnd)
          if (segment.trim()) {
            nonTagRegions.push({ start: lastEnd, end: bodyContent.length })
          }
        }

        if (nonTagRegions.length > 0) {
          const wrapStart = nonTagRegions[0].start
          const wrapEnd = nonTagRegions[nonTagRegions.length - 1].end
          const before = bodyContent.substring(0, wrapStart)
          const wrapped = bodyContent.substring(wrapStart, wrapEnd)
          const after = bodyContent.substring(wrapEnd)
          const cleanWrapped = wrapped.replace(/^\n+/, '').replace(/\n+$/, '')
          const cleanBefore = before.replace(/\n+$/, '')
          const cleanAfter = after.replace(/^\n+/, '')

          const newBodyContent = `${cleanBefore}\n<!--[slot:${orderMap['html']}${pauseStr}]-->\n${cleanWrapped}\n<!--[/slot]-->\n${cleanAfter}`
          result = result.substring(0, bodyStart) + newBodyContent + result.substring(bodyEnd)
        }
      }
    }

    return result
  })

  async function copySlotConfigCode() {
    const code = slotConfigGenerated.value
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      slotConfigCopied.value = true
      setTimeout(() => { slotConfigCopied.value = false }, 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      slotConfigCopied.value = true
      setTimeout(() => { slotConfigCopied.value = false }, 2000)
    }
  }

  function useSlotConfigCode() {
    const generated = slotConfigGenerated.value
    if (!generated) return
    showSlotConfigModal.value = false
    options.onUseCode(generated)
  }

  return {
    showSlotConfigModal,
    slotConfigInput,
    slotConfigParsedHTML,
    slotConfigParsedCSS,
    slotConfigParsedJS,
    slotConfigOrder,
    slotConfigPauseBetween,
    slotConfigDragging,
    slotConfigDragOver,
    slotConfigCopied,
    slotConfigHasParsed,
    slotConfigStats,
    slotConfigGenerated,
    openSlotConfigModal,
    closeSlotConfigModal,
    onSlotConfigDragStart,
    onSlotConfigDragEnd,
    onSlotConfigDragEnter,
    onSlotConfigDragLeave,
    onSlotConfigDrop,
    moveSlotConfig,
    getSlotConfigParsed,
    copySlotConfigCode,
    useSlotConfigCode,
  }
}
