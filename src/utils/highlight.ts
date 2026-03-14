import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import 'highlight.js/styles/atom-one-dark.css'

let initialized = false

export function initHighlighter(): void {
  if (initialized) return
  hljs.registerLanguage('xml', xml)
  hljs.registerLanguage('css', css)
  hljs.registerLanguage('javascript', javascript)
  initialized = true
}

export function highlightCode(code: string): string {
  try {
    return hljs.highlight(code, { language: 'xml' }).value
  } catch {
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
      const semiIdx = html.indexOf(';', i)
      if (semiIdx !== -1 && semiIdx - i < 10) {
        i = semiIdx + 1
      } else {
        i++
      }
      textCount++
    } else {
      i++
      textCount++
    }
  }

  const cursorHTML = '<span class="typing-cursor"></span>'
  return html.substring(0, i) + cursorHTML + html.substring(i)
}
