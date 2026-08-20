/**
 * CDP browser driver for the browser_debug tool.
 *
 * Launches a real local Chrome/Edge via Playwright (playwright-core, already
 * vendored) with `--remote-debugging-port` (CDP) exposed, aimed at the app URL
 * (default http://localhost:3000). All verbs route through the fail-closed
 * env gate + loopback guard; the whole capability is refused unless
 * `OM_ENABLE_AGENT_BROWSER_DEBUG=1`.
 *
 * A single process-lifetime session is kept so agent navigation across calls
 * (open -> click -> screenshot -> back) follows one browser/page instead of
 * opening a fresh browser per verb. playwright-core is lazy-imported so merely
 * loading the module does not pull the browser runtime into the app boot.
 */

import { assertBrowserDebugEnabled, assertLoopbackTarget, defaultBrowserUrl } from './loopback-guard'
import type { Browser, Page, BrowserType } from 'playwright-core'

export interface ConsoleEntry {
  level: string
  text: string
}

const MAX_DOM_CHARS = 8192
const MAX_CONSOLE_ENTRIES = 200

let sessionBrowser: Browser | null = null
let sessionPage: Page | null = null
let consoleBuffer: ConsoleEntry[] = []

export interface BrowserDebugSession {
  browser: Browser
  page: Page
  consoleEntries: ConsoleEntry[]
}

function artifactDir(): string {
  return process.env.OM_AGENT_BROWSER_ARTIFACT_DIR || process.env.TMPDIR || '/tmp'
}

async function open(): Promise<BrowserDebugSession> {
  assertBrowserDebugEnabled()

  if (sessionBrowser && sessionPage) {
    return { browser: sessionBrowser, page: sessionPage, consoleEntries: consoleBuffer }
  }

  // Lazy import keeps the heavy Playwright runtime out of app boot.
  const { chromium } = await import('playwright-core')
  const cdpPort = process.env.OM_AGENT_BROWSER_CDP_PORT
  // Expose a real CDP endpoint so external debuggers / the R1 MCP path can
  // attach via `--remote-debugging-port` (ephemeral default).
  const args = [`--remote-debugging-port=${cdpPort && cdpPort.length > 0 ? cdpPort : '0'}`]

  const execPath = process.env.OM_AGENT_BROWSER_EXECUTABLE
  const channel = process.env.OM_AGENT_BROWSER_CHANNEL

  // Launch with fallbacks: explicit executable → channel → bundled Chromium.
  let browser: Browser
  if (execPath && execPath.length > 0) {
    browser = await chromium.launch({ headless: true, executablePath: execPath, args })
  } else {
    const channels = channel && channel.length > 0 ? [channel] : ['chrome', 'msedge']
    browser = await launchWithFailureFallback(chromium, channels, args)
  }

  const page = await browser.newPage()

  consoleBuffer = []
  page.on('console', (msg) => {
    if (consoleBuffer.length >= MAX_CONSOLE_ENTRIES) consoleBuffer.shift()
    consoleBuffer.push({ level: msg.type(), text: msg.text() })
  })

  sessionBrowser = browser
  sessionPage = page

  browser.on('disconnected', () => {
    sessionBrowser = null
    sessionPage = null
  })

  return { browser, page, consoleEntries: consoleBuffer }
}

/** Try local Chrome/Edge channels first, then fall back to Playwright's bundled Chromium. */
async function launchWithFailureFallback(
  browserType: BrowserType,
  channels: string[],
  args: string[],
): Promise<Browser> {
  let lastError: unknown
  for (const ch of channels) {
    try {
      return await browserType.launch({ headless: true, channel: ch, args })
    } catch (error) {
      lastError = error
    }
  }
  try {
    return await browserType.launch({ headless: true, args })
  } catch (error) {
    // Report the most useful message (prefer a channel error that names the browser).
    throw lastError ?? error
  }
}

function requirePage(): Page {
  if (!sessionPage) {
    throw new Error('browser_debug: no active page. Call browser_debug.open first.')
  }
  return sessionPage
}

export interface NavigateResult {
  url: string
  title: string
  status: number | null
}

/** `open` / `navigate` — loopback-guarded goto. */
export async function navigate(targetUrl?: string): Promise<NavigateResult> {
  assertBrowserDebugEnabled()
  const { page } = await open()
  const url = assertLoopbackTarget(targetUrl && targetUrl.length > 0 ? targetUrl : defaultBrowserUrl()).href
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
  return { url: page.url(), title: await page.title(), status: response?.status() ?? null }
}

export interface ScreenshotResult {
  artifactPath: string
  pageUrl: string
}

/** `screenshot` — persist a debug artifact and return its path. */
export async function screenshot(path?: string): Promise<ScreenshotResult> {
  assertBrowserDebugEnabled()
  const page = requirePage()
  const fileName = path && path.length > 0 ? path : `browser-debug-${Date.now()}.png`
  const artifactPath = fileName.startsWith('/') ? fileName : `${artifactDir()}/${fileName}`
  await page.screenshot({ path: artifactPath })
  return { artifactPath, pageUrl: page.url() }
}

export interface DomResult {
  text: string
  truncated: boolean
}

/** `read_dom` — body innerText (the structured DOM is huge); truncation ceiling. */
export async function readDom(): Promise<DomResult> {
  assertBrowserDebugEnabled()
  const page = requirePage()
  const text = (await page.locator('body').innerText().catch(() => '')) || ''
  const truncated = text.length > MAX_DOM_CHARS
  return { text: truncated ? text.slice(0, MAX_DOM_CHARS) : text, truncated }
}

/** `read_console` — console entries collected since navigation. */
export async function readConsole(): Promise<{ entries: ConsoleEntry[] }> {
  assertBrowserDebugEnabled()
  return { entries: consoleBuffer.slice() }
}

export interface ClickResult {
  ok: true
  url: string
}

/** `click` — CSS selector based click. */
export async function click(selector: string): Promise<ClickResult> {
  assertBrowserDebugEnabled()
  const page = requirePage()
  await page.locator(selector).first().click()
  return { ok: true, url: page.url() }
}

/** `back` — history back. */
export async function goBack(): Promise<{ url: string }> {
  assertBrowserDebugEnabled()
  const page = requirePage()
  await page.goBack().catch(() => undefined)
  return { url: page.url() }
}

/** Close the shared browser session (idempotent). */
export async function closeSession(): Promise<void> {
  if (sessionBrowser) {
    await sessionBrowser.close().catch(() => undefined)
  }
  sessionBrowser = null
  sessionPage = null
  consoleBuffer = []
}
