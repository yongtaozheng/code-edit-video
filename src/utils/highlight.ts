import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import { useTheme } from '../composables/useTheme'

let initialized = false

export function initHighlighter(): void {
  if (initialized) return
  hljs.registerLanguage('xml', xml)
  hljs.registerLanguage('css', css)
  hljs.registerLanguage('javascript', javascript)

  // 初始化主题系统（加载已保存的 hljs CSS + 应用编辑器配色）
  const { initTheme } = useTheme()
  initTheme()

  initialized = true
}

export function highlightCode(code: string): string {
  try {
    return hljs.highlight(code, { language: 'xml' }).value
  } catch (e) {
    console.warn('[highlightCode] Syntax highlighting failed, falling back to raw code:', e)
    return code
  }
}

/**
 * Insert a blinking cursor element into syntax-highlighted HTML at the given
 * character position.
 */
export function insertCursorInHighlightedHTML(html: string, charPos: number): string {
  let textCount = 0
  let i = 0

  while (i < html.length && textCount < charPos) {
    if (html[i] === '<') {
      while (i < html.length && html[i] !== '>') i++
      i++
    } else if (html[i] === '&') {
      // Bounded lookahead (max 10 chars) to find the closing ';' of an HTML
      // entity.  The previous indexOf(';', i) scanned to end-of-string on
      // every '&', causing O(n²) in the worst case.
      let found = false
      const limit = Math.min(i + 10, html.length)
      for (let j = i + 1; j < limit; j++) {
        if (html[j] === ';') {
          i = j + 1
          found = true
          break
        }
      }
      if (!found) i++
      textCount++
    } else {
      i++
      textCount++
    }
  }

  const cursorHTML = '<span class="typing-cursor"></span>'
  return html.substring(0, i) + cursorHTML + html.substring(i)
}
