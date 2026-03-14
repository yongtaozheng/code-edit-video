import type { SplitResult } from '../types'

/**
 * Remove the common leading whitespace from every line of a code block.
 */
export function dedentCode(code: string): string {
  const lines = code.split('\n')
  let minIndent = Infinity
  for (const line of lines) {
    if (line.trim().length === 0) continue
    const leadingSpaces = line.match(/^(\s*)/)
    if (leadingSpaces) {
      minIndent = Math.min(minIndent, leadingSpaces[1].length)
    }
  }
  if (minIndent === 0 || minIndent === Infinity) return code
  return lines.map(line => line.slice(Math.min(minIndent, line.length))).join('\n')
}

/**
 * Parse the current code and split it into HTML, CSS, and JS sections.
 */
export function splitCodeForCodePen(source: string): SplitResult {
  const cssBlocks: string[] = []
  const jsBlocks: string[] = []

  const styleBlockRe = new RegExp('<' + 'style' + '[^>]*>([\\s\\S]*?)</' + 'style>', 'gi')
  let match: RegExpExecArray | null
  while ((match = styleBlockRe.exec(source)) !== null) {
    const content = dedentCode(match[1]).trim()
    if (content) cssBlocks.push(content)
  }

  const scriptBlockRe = new RegExp('<' + 'script' + '[^>]*>([\\s\\S]*?)</' + 'script>', 'gi')
  while ((match = scriptBlockRe.exec(source)) !== null) {
    const content = dedentCode(match[1]).trim()
    if (content) jsBlocks.push(content)
  }

  let html = source
  const styleTagRe = new RegExp('<' + 'style' + '[^>]*>[\\s\\S]*?</' + 'style>', 'gi')
  const scriptTagRe = new RegExp('<' + 'script' + '[^>]*>[\\s\\S]*?</' + 'script>', 'gi')
  html = html.replace(styleTagRe, '')
  html = html.replace(scriptTagRe, '')

  html = html.replace(new RegExp('<' + '!DOCTYPE[^>]*>', 'gi'), '')
  html = html.replace(new RegExp('<' + '/?html[^>]*>', 'gi'), '')
  html = html.replace(new RegExp('<' + '/?head[^>]*>', 'gi'), '')
  html = html.replace(new RegExp('<' + '/?body[^>]*>', 'gi'), '')
  html = html.replace(new RegExp('<' + 'meta[^>]*/?' + '>', 'gi'), '')
  html = html.replace(new RegExp('<' + 'title[^>]*>[\\s\\S]*?</' + 'title>', 'gi'), '')
  html = html.replace(new RegExp('<' + 'link[^>]*/?' + '>', 'gi'), '')

  html = dedentCode(html.replace(/\n{3,}/g, '\n\n')).trim()

  return {
    html,
    css: cssBlocks.join('\n\n'),
    js: jsBlocks.join('\n\n'),
  }
}
