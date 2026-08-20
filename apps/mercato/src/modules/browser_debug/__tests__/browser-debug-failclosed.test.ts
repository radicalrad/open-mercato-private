/**
 * Negative / positive (fail-closed) registration tests for browser_debug.
 *
 * These must NOT launch a real browser. They verify that the in-app tool set
 * is empty when the OM_ENABLE_AGENT_BROWSER_DEBUG flag is unset (and non-empty
 * when set to "1"), and that driver verbs throw before touching Playwright.
 *
 * Module-state is re-evaluated via `jest.isolateModules` so these assertions
 * hold regardless of the ambient environment in which jest itself runs.
 */
import { navigate } from '../lib/browser-debug'
import { assertBrowserDebugEnabled } from '../lib/loopback-guard'

const FLAG = 'OM_ENABLE_AGENT_BROWSER_DEBUG'

function aiToolsLength(flag: string | undefined): number {
  let length = -1
  jest.isolateModules(() => {
    if (flag === undefined) delete process.env[FLAG]
    else process.env[FLAG] = flag
    const mod = require('../ai-tools') as { aiTools?: unknown[] }
    length = Array.isArray(mod.aiTools) ? mod.aiTools.length : -1
  })
  return length
}

describe('browser_debug fail-closed registration', () => {
  it('registers no in-app tools when the flag is unset', () => {
    expect(aiToolsLength(undefined)).toBe(0)
  })

  it('registers the browser_debug tools when the flag is "1"', () => {
    expect(aiToolsLength('1')).toBeGreaterThan(0)
  })

  it('refuses to launch/navigate when the flag is unset (throws before Playwright)', async () => {
    delete process.env[FLAG]
    let caught: unknown = null
    try {
      await navigate('http://localhost:3000')
    } catch (error) {
      caught = error
    }
    expect(caught).toMatchObject({ code: 'OM_BROWSER_DISABLED' })
  })

  it('assertBrowserDebugEnabled throws when unset', () => {
    delete process.env[FLAG]
    expect(() => assertBrowserDebugEnabled()).toThrow()
  })
})
