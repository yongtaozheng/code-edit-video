import type { ThemeDefinition } from '../types'

export const THEMES: ThemeDefinition[] = [
  // ── 默认主题（当前外观） ──────────────────────────
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    mode: 'dark',
    hljsStyle: 'atom-one-dark',
    editor: {
      background: '#1e1e2e',
      textColor: '#cdd6f4',
      surfaceColor: '#181825',
      surfaceDeepColor: '#11111b',
      borderColor: '#313244',
      mutedColor: '#6c7086',
      cursorColor: '#f5e0dc',
      cursorGlow: 'rgba(245, 224, 220, 0.5)',
      lineNumberColor: '#45475a',
      selectionColor: 'rgba(203, 166, 247, 0.2)',
      placeholderColor: '#45475a',
      accentColor: '#cba6f7',
      scrollbarColor: '#313244',
      scrollbarHoverColor: '#45475a',
    },
  },

  // ── Atom One Dark ────────────────────────────────
  {
    id: 'atom-one-dark',
    label: 'Atom One Dark',
    mode: 'dark',
    hljsStyle: 'atom-one-dark',
    editor: {
      background: '#282c34',
      textColor: '#abb2bf',
      surfaceColor: '#21252b',
      surfaceDeepColor: '#1b1f23',
      borderColor: '#3e4451',
      mutedColor: '#5c6370',
      cursorColor: '#528bff',
      cursorGlow: 'rgba(82, 139, 255, 0.4)',
      lineNumberColor: '#4b5263',
      selectionColor: 'rgba(82, 139, 255, 0.2)',
      placeholderColor: '#4b5263',
      accentColor: '#61afef',
      scrollbarColor: '#3e4451',
      scrollbarHoverColor: '#4b5263',
    },
  },

  // ── GitHub Dark ──────────────────────────────────
  {
    id: 'github-dark',
    label: 'GitHub Dark',
    mode: 'dark',
    hljsStyle: 'github-dark',
    editor: {
      background: '#0d1117',
      textColor: '#c9d1d9',
      surfaceColor: '#010409',
      surfaceDeepColor: '#010409',
      borderColor: '#21262d',
      mutedColor: '#8b949e',
      cursorColor: '#58a6ff',
      cursorGlow: 'rgba(88, 166, 255, 0.4)',
      lineNumberColor: '#484f58',
      selectionColor: 'rgba(56, 139, 253, 0.25)',
      placeholderColor: '#484f58',
      accentColor: '#58a6ff',
      scrollbarColor: '#21262d',
      scrollbarHoverColor: '#484f58',
    },
  },

  // ── GitHub Light ─────────────────────────────────
  {
    id: 'github-light',
    label: 'GitHub Light',
    mode: 'light',
    hljsStyle: 'github',
    editor: {
      background: '#ffffff',
      textColor: '#24292e',
      surfaceColor: '#f6f8fa',
      surfaceDeepColor: '#eaeef2',
      borderColor: '#d0d7de',
      mutedColor: '#6e7781',
      cursorColor: '#0969da',
      cursorGlow: 'rgba(9, 105, 218, 0.3)',
      lineNumberColor: '#8c959f',
      selectionColor: 'rgba(9, 105, 218, 0.15)',
      placeholderColor: '#8c959f',
      accentColor: '#0969da',
      scrollbarColor: '#d0d7de',
      scrollbarHoverColor: '#afb8c1',
    },
  },

  // ── Monokai ──────────────────────────────────────
  {
    id: 'monokai',
    label: 'Monokai',
    mode: 'dark',
    hljsStyle: 'monokai',
    editor: {
      background: '#272822',
      textColor: '#f8f8f2',
      surfaceColor: '#1e1f1c',
      surfaceDeepColor: '#171814',
      borderColor: '#3e3d32',
      mutedColor: '#75715e',
      cursorColor: '#f8f8f0',
      cursorGlow: 'rgba(248, 248, 240, 0.4)',
      lineNumberColor: '#575851',
      selectionColor: 'rgba(253, 151, 31, 0.2)',
      placeholderColor: '#575851',
      accentColor: '#a6e22e',
      scrollbarColor: '#3e3d32',
      scrollbarHoverColor: '#575851',
    },
  },

  // ── Night Owl ────────────────────────────────────
  {
    id: 'night-owl',
    label: 'Night Owl',
    mode: 'dark',
    hljsStyle: 'night-owl',
    editor: {
      background: '#011627',
      textColor: '#d6deeb',
      surfaceColor: '#001122',
      surfaceDeepColor: '#000c1d',
      borderColor: '#122d42',
      mutedColor: '#637777',
      cursorColor: '#80a4c2',
      cursorGlow: 'rgba(128, 164, 194, 0.4)',
      lineNumberColor: '#4b6479',
      selectionColor: 'rgba(29, 115, 173, 0.3)',
      placeholderColor: '#4b6479',
      accentColor: '#82aaff',
      scrollbarColor: '#122d42',
      scrollbarHoverColor: '#4b6479',
    },
  },

  // ── Tokyo Night ──────────────────────────────────
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    mode: 'dark',
    hljsStyle: 'tokyo-night-dark',
    editor: {
      background: '#1a1b26',
      textColor: '#a9b1d6',
      surfaceColor: '#16161e',
      surfaceDeepColor: '#13131a',
      borderColor: '#292e42',
      mutedColor: '#565f89',
      cursorColor: '#c0caf5',
      cursorGlow: 'rgba(192, 202, 245, 0.4)',
      lineNumberColor: '#3b4261',
      selectionColor: 'rgba(41, 46, 66, 0.5)',
      placeholderColor: '#3b4261',
      accentColor: '#7aa2f7',
      scrollbarColor: '#292e42',
      scrollbarHoverColor: '#3b4261',
    },
  },

  // ── Nord ─────────────────────────────────────────
  {
    id: 'nord',
    label: 'Nord',
    mode: 'dark',
    hljsStyle: 'nord',
    editor: {
      background: '#2e3440',
      textColor: '#d8dee9',
      surfaceColor: '#272c36',
      surfaceDeepColor: '#22272f',
      borderColor: '#3b4252',
      mutedColor: '#616e88',
      cursorColor: '#88c0d0',
      cursorGlow: 'rgba(136, 192, 208, 0.4)',
      lineNumberColor: '#4c566a',
      selectionColor: 'rgba(136, 192, 208, 0.15)',
      placeholderColor: '#4c566a',
      accentColor: '#88c0d0',
      scrollbarColor: '#3b4252',
      scrollbarHoverColor: '#4c566a',
    },
  },

  // ── VS Code Dark ─────────────────────────────────
  {
    id: 'vs-dark',
    label: 'VS Code Dark',
    mode: 'dark',
    hljsStyle: 'vs2015',
    editor: {
      background: '#1e1e1e',
      textColor: '#d4d4d4',
      surfaceColor: '#181818',
      surfaceDeepColor: '#141414',
      borderColor: '#2d2d2d',
      mutedColor: '#808080',
      cursorColor: '#d4d4d4',
      cursorGlow: 'rgba(212, 212, 212, 0.3)',
      lineNumberColor: '#505050',
      selectionColor: 'rgba(38, 79, 120, 0.5)',
      placeholderColor: '#505050',
      accentColor: '#569cd6',
      scrollbarColor: '#2d2d2d',
      scrollbarHoverColor: '#505050',
    },
  },

  // ── VS Code Light ────────────────────────────────
  {
    id: 'vs-light',
    label: 'VS Code Light',
    mode: 'light',
    hljsStyle: 'vs',
    editor: {
      background: '#ffffff',
      textColor: '#000000',
      surfaceColor: '#f3f3f3',
      surfaceDeepColor: '#ececec',
      borderColor: '#d4d4d4',
      mutedColor: '#858585',
      cursorColor: '#000000',
      cursorGlow: 'rgba(0, 0, 0, 0.2)',
      lineNumberColor: '#858585',
      selectionColor: 'rgba(173, 214, 255, 0.5)',
      placeholderColor: '#858585',
      accentColor: '#0451a5',
      scrollbarColor: '#d4d4d4',
      scrollbarHoverColor: '#a0a0a0',
    },
  },
]

export const DEFAULT_THEME_ID = 'catppuccin-mocha'

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id)
}
