/**
 * Positive (enabled-flag) integration test for browser_debug.
 *
 * Launches a real local Chromium over CDP against an ephemeral loopback HTTP
 * server and verifies agent-driven navigation + screenshot + read_dom land on
 * the target page, and that non-loopback targets are refused.
 *
 * Fail-closed by construction: this suite is SKIPPED unless
 * `OM_ENABLE_AGENT_BROWSER_DEBUG=1` (mirroring the tool's own gate — in CI the
 * flag is unset so the negative path is what runs; run with the flag to
 * exercise the live browser).
 */
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import * as fs from 'node:fs'
import { navigate, screenshot, readDom, closeSession } from '../lib/browser-debug'

const ENABLED = process.env.OM_ENABLE_AGENT_BROWSER_DEBUG === '1'

const suite = ENABLED ? describe : describe.skip

suite('browser_debug positive / enabled', () => {
  let server: http.Server
  let port = 0
  let baseUrl = ''

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('content-type', 'text/html')
      const recordId = req.url?.match(/\/record\/(\d+)/)?.[1] ?? 'root'
      res.end(
        `<!doctype html><html><head><title>record-${recordId}</title></head>` +
          `<body><h1 id="title">record-${recordId}</h1><p>hello browser_debug</p></body></html>`,
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    await closeSession()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it(
    'navigates, reads the DOM and screenshots an ephemeral app (lands on a record)',
    async () => {
      const result = await navigate(`${baseUrl}/record/123`)
    expect(result.url).toContain('/record/123')
    expect(result.title).toBe('record-123')

    const dom = await readDom()
    expect(dom.text).toContain('record-123')
    expect(dom.text).toContain('hello browser_debug')

    const shot = await screenshot()
    expect(fs.existsSync(shot.artifactPath)).toBe(true)
    expect(shot.artifactPath.endsWith('.png')).toBe(true)
    expect(shot.pageUrl).toContain('/record/123')
    },
    30_000,
  )

  it('refuses a non-loopback target even when enabled', async () => {
    let caught: unknown = null
    try {
      await navigate('http://169.254.169.254/some/cloud/metadata')
    } catch (error) {
      caught = error
    }
    expect(caught).toMatchObject({ code: 'OM_BROWSER_NON_LOOPBACK' })
  })
})
