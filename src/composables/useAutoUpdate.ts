import { ref } from 'vue'

/**
 * GitHub Releases 自动更新检测 composable
 *
 * 启动时自动检查 GitHub 最新 Release 版本，与当前应用版本比较。
 * 支持手动检查、忽略特定版本、打开下载页。
 */

const GITHUB_OWNER = 'yongtaozheng'
const GITHUB_REPO = 'code-edit-video'
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=30&page=1`
const DISMISSED_KEY = 'auto-update-dismissed-version'

// ─── Shared singleton state ───
const updateAvailable = ref(false)
const latestVersion = ref('')
const currentVersion = ref('')
const releaseUrl = ref('')
const releaseNotes = ref('')
const checking = ref(false)
const error = ref('')
let hasAutoChecked = false

type GithubRelease = {
  tag_name?: string
  html_url?: string
  body?: string
  draft?: boolean
  prerelease?: boolean
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '').split('-')[0]
}

function parseVersion(version: string): number[] | null {
  const normalized = normalizeVersion(version)
  if (!normalized) return null

  const parts = normalized.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.some((n) => Number.isNaN(n))) return null
  return parts
}

/**
 * Compare two semver strings.
 * Returns  1 if a > b,  -1 if a < b,  0 if equal.
 */
function compareSemver(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)

  // Fallback to string compare when version format is unexpected.
  if (!pa || !pb) {
    return normalizeVersion(a).localeCompare(normalizeVersion(b))
  }

  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

/**
 * Fetch stable releases and pick the highest semver tag.
 * This avoids GitHub "latest" edge cases when multiple releases point to the same commit.
 */
async function fetchLatestRelease(): Promise<GithubRelease | null> {
  const response = await fetch(RELEASES_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!Array.isArray(payload)) return null

  const releases = (payload as GithubRelease[])
    .filter((release) => !release.draft && !release.prerelease)
    .filter((release) => typeof release.tag_name === 'string' && release.tag_name.length > 0)

  if (releases.length === 0) return null

  releases.sort((a, b) => compareSemver(b.tag_name!, a.tag_name!))
  return releases[0] ?? null
}

/**
 * Detect whether the app is running inside a Tauri webview.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Get the current app version from Tauri.
 */
async function getAppVersion(): Promise<string> {
  if (!isTauri()) return '0.0.0'
  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion()
}

/**
 * Open a URL in the system default browser via Tauri opener plugin.
 */
async function openInBrowser(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank')
    return
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(url)
}

/**
 * Check GitHub Releases for a newer version.
 */
async function checkForUpdate(manual = false): Promise<void> {
  if (checking.value) return

  checking.value = true
  error.value = ''

  try {
    // Get current version
    currentVersion.value = await getAppVersion()

    // Fetch and compute latest stable release by semver
    const latestRelease = await fetchLatestRelease()
    if (!latestRelease) {
      updateAvailable.value = false
      return
    }

    const tagName = latestRelease.tag_name ?? ''
    const remoteVersion = normalizeVersion(tagName)

    latestVersion.value = remoteVersion
    releaseUrl.value = latestRelease.html_url ?? ''
    releaseNotes.value = latestRelease.body ?? ''

    // Check if this version was dismissed
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (!manual && dismissed === remoteVersion) {
      updateAvailable.value = false
      return
    }

    // Compare versions
    if (compareSemver(remoteVersion, currentVersion.value) > 0) {
      updateAvailable.value = true
      // Clear dismissed if manually checking
      if (manual) {
        localStorage.removeItem(DISMISSED_KEY)
      }
    } else {
      updateAvailable.value = false
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    error.value = msg
    console.warn('[AutoUpdate] Check failed:', msg)
  } finally {
    checking.value = false
  }
}

/**
 * Dismiss the current update notification.
 * Stores the version so it won't be shown again until a newer release.
 */
function dismissUpdate(): void {
  if (latestVersion.value) {
    localStorage.setItem(DISMISSED_KEY, latestVersion.value)
  }
  updateAvailable.value = false
}

/**
 * Open the GitHub Release page in the system browser.
 */
async function openReleasePage(): Promise<void> {
  const url =
    releaseUrl.value ||
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
  await openInBrowser(url)
}

export function useAutoUpdate() {
  // Auto-check once on first use (delayed to not block startup)
  if (!hasAutoChecked && isTauri()) {
    hasAutoChecked = true
    setTimeout(() => checkForUpdate(false), 2000)
  }

  return {
    /** Whether a new version is available */
    updateAvailable,
    /** The latest version string (e.g. "0.2.0") */
    latestVersion,
    /** The current app version string (e.g. "0.1.0") */
    currentVersion,
    /** URL to the GitHub Release page */
    releaseUrl,
    /** Release notes (markdown body) */
    releaseNotes,
    /** Whether a check is currently in progress */
    checking,
    /** Last error message (empty if no error) */
    error,
    /** Manually trigger an update check */
    checkForUpdate: () => checkForUpdate(true),
    /** Dismiss the update notification for the current version */
    dismissUpdate,
    /** Open the release page in the system browser */
    openReleasePage,
  }
}
