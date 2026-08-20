/**
 * Fail-closed security gate for the browser_debug tool.
 *
 * The whole capability is OFF unless `OM_ENABLE_AGENT_BROWSER_DEBUG` is
 * exactly `'1'`. Every verb (in-app tool and MCP server alike) funnels through
 * `assertBrowserDebugEnabled()` / `isBrowserDebugEnabled()`. Production MUST
 * keep the flag unset so the capability fails closed.
 */

export const OM_ENABLE_AGENT_BROWSER_DEBUG = 'OM_ENABLE_AGENT_BROWSER_DEBUG'

/** Default landing URL for the browser tool (loopback app dev server). */
export const DEFAULT_AGENT_BROWSER_URL = 'http://localhost:3000'

export interface LoopbackGuardError extends Error {
  code: 'OM_BROWSER_DISABLED' | 'OM_BROWSER_NON_LOOPBACK' | 'OM_BROWSER_BAD_SCHEME'
}

function guardError(code: LoopbackGuardError['code'], message: string): LoopbackGuardError {
  const err = new Error(message) as LoopbackGuardError
  err.code = code
  return err
}

/**
 * True only when the env flag is exactly `'1'`. Unset, `'0'`, or any other
 * value ⇒ disabled (fail closed).
 */
export function isBrowserDebugEnabled(): boolean {
  return process.env[OM_ENABLE_AGENT_BROWSER_DEBUG] === '1'
}

/** Throws a hard OM_BROWSER_DISABLED error unless the flag is `'1'`. */
export function assertBrowserDebugEnabled(): void {
  if (!isBrowserDebugEnabled()) {
    throw guardError(
      'OM_BROWSER_DISABLED',
      `browser_debug is disabled. Set ${OM_ENABLE_AGENT_BROWSER_DEBUG}=1 to enable (fail-closed; do not set in production).`,
    )
  }
}

/**
 * Loopback-only target policy. Accepts http(s) URLs whose host is exactly
 * `localhost`, `127.0.0.1` or `::1` — anything else (including hostnames that
 * would DNS-resolve off-loopback, other numeric IPs, and `file:`/non-http
 * schemes) is rejected. Fail closed: unknown hosts are denied, never allowed.
 */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1'])

export function assertLoopbackTarget(urlString: string): URL {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw guardError('OM_BROWSER_NON_LOOPBACK', `Invalid target URL: "${urlString}"`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw guardError(
      'OM_BROWSER_BAD_SCHEME',
      `browser_debug only allows http(s) targets, got scheme "${url.protocol}"`,
    )
  }

  // Strip IPv6 brackets so `[::1]` and `::1` both match.
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!LOOPBACK_HOSTNAMES.has(host)) {
    throw guardError(
      'OM_BROWSER_NON_LOOPBACK',
      `browser_debug refuses non-loopback target "${urlString}" (host "${host}"). Only localhost / 127.0.0.1 / ::1 are allowed.`,
    )
  }

  return url
}

/** Returns the configured landing URL (loopback-guarded). */
export function defaultBrowserUrl(): string {
  return process.env.OM_AGENT_BROWSER_URL || DEFAULT_AGENT_BROWSER_URL
}
