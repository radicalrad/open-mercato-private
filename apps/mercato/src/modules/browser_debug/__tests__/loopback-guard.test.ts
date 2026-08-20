import {
  isBrowserDebugEnabled,
  assertBrowserDebugEnabled,
  assertLoopbackTarget,
  DEFAULT_AGENT_BROWSER_URL,
} from '../lib/loopback-guard'

function withEnv(value: string | undefined, fn: () => void): void {
  const key = 'OM_ENABLE_AGENT_BROWSER_DEBUG'
  const prev = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  try {
    fn()
  } finally {
    if (prev === undefined) delete process.env[key]
    else process.env[key] = prev
  }
}

describe('loopback-guard: fail-closed env gate', () => {
  it('is enabled only when the flag is exactly "1"', () => {
    withEnv('1', () => expect(isBrowserDebugEnabled()).toBe(true))
    withEnv('0', () => expect(isBrowserDebugEnabled()).toBe(false))
    withEnv('true', () => expect(isBrowserDebugEnabled()).toBe(false))
    withEnv(undefined, () => expect(isBrowserDebugEnabled()).toBe(false))
  })

  it('assertBrowserDebugEnabled throws OM_BROWSER_DISABLED when the flag is not "1"', () => {
    withEnv(undefined, () => {
      expect(() => assertBrowserDebugEnabled()).toThrow(
        expect.objectContaining({ code: 'OM_BROWSER_DISABLED' }),
      )
    })
    withEnv('1', () => {
      expect(() => assertBrowserDebugEnabled()).not.toThrow()
    })
  })
})

describe('loopback-guard: target policy', () => {
  it('allows loopback targets', () => {
    for (const url of [
      'http://localhost:3000',
      'http://localhost',
      'http://127.0.0.1:3000/path?x=1',
      'https://localhost:3000',
      'http://[::1]:3000',
    ]) {
      expect(assertLoopbackTarget(url).hostname.length).toBeGreaterThan(0)
    }
  })

  it('rejects non-loopback hosts (fail closed)', () => {
    for (const url of [
      'http://example.com',
      'http://10.0.0.1:3000',
      'http://192.168.0.1',
      'http://[2001:db8::1]',
      'http://0.0.0.0:3000',
    ]) {
      expect(() => assertLoopbackTarget(url)).toThrow(
        expect.objectContaining({ code: 'OM_BROWSER_NON_LOOPBACK' }),
      )
    }
  })

  it('rejects non-http schemes and malformed urls', () => {
    expect(() => assertLoopbackTarget('file:///etc/passwd')).toThrow(
      expect.objectContaining({ code: 'OM_BROWSER_BAD_SCHEME' }),
    )
    expect(() => assertLoopbackTarget('javascript:alert(1)')).toThrow()
    expect(() => assertLoopbackTarget('not a url')).toThrow()
  })

  it('defaults to the local dev server', () => {
    expect(DEFAULT_AGENT_BROWSER_URL).toBe('http://localhost:3000')
  })
})
