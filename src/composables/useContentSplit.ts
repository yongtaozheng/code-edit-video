import { ref, type Ref } from 'vue'
import { splitCodeForCodePen } from '../utils/codeSplitter'

export function useContentSplit(options: {
  code: Ref<string>
}) {
  const { code } = options

  const showSplitModal = ref(false)
  const splitHTML = ref('')
  const splitCSS = ref('')
  const splitJS = ref('')
  const copiedSection = ref<'html' | 'css' | 'js' | ''>('')

  function openSplitModal() {
    const source = code.value
    if (!source.trim()) return
    const result = splitCodeForCodePen(source)
    splitHTML.value = result.html
    splitCSS.value = result.css
    splitJS.value = result.js
    copiedSection.value = ''
    showSplitModal.value = true
  }

  function closeSplitModal() {
    showSplitModal.value = false
    copiedSection.value = ''
  }

  async function copySplitSection(section: 'html' | 'css' | 'js') {
    const content = section === 'html' ? splitHTML.value
      : section === 'css' ? splitCSS.value
      : splitJS.value
    try {
      await navigator.clipboard.writeText(content)
      copiedSection.value = section
      setTimeout(() => {
        if (copiedSection.value === section) copiedSection.value = ''
      }, 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      copiedSection.value = section
      setTimeout(() => {
        if (copiedSection.value === section) copiedSection.value = ''
      }, 2000)
    }
  }

  function openInCodePen() {
    const data = {
      html: splitHTML.value,
      css: splitCSS.value,
      js: splitJS.value,
    }
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = 'https://codepen.io/pen/define'
    form.target = '_blank'
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = 'data'
    input.value = JSON.stringify(data)
    form.appendChild(input)
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  return {
    showSplitModal,
    splitHTML,
    splitCSS,
    splitJS,
    copiedSection,
    openSplitModal,
    closeSplitModal,
    copySplitSection,
    openInCodePen,
  }
}
