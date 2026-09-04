import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

/**
 * DARAA-100 guard. The app dispatcher used to never consult the interceptor
 * registry, so any hand-written module route relying on a registered interceptor
 * for a security control was silently fail-open (this is how NEMO SEC-01 happened).
 *
 * These assertions pin the dispatcher's interceptor wiring in place so the
 * fail-open class cannot silently return.
 */

const templateDispatcherUrl = new URL(
  '../../template/src/app/api/[...slug]/route.ts',
  import.meta.url,
)
const monorepoDispatcherUrl = new URL(
  '../../../../apps/mercato/src/app/api/[...slug]/route.ts',
  import.meta.url,
)

function readSource(url: URL): string {
  return fs.readFileSync(url, 'utf8')
}

for (const [label, url] of [
  ['template', templateDispatcherUrl],
  ['monorepo', monorepoDispatcherUrl],
] as const) {
  test(`${label} API dispatcher runs the API interceptor chain for module routes (DARAA-100)`, () => {
    const source = readSource(url)

    assert.match(
      source,
      /withDispatcherApiInterceptors/,
      'dispatcher must run the interceptor chain so hand-written routes are not fail-open',
    )
    assert.match(
      source,
      /normalizeDispatcherRoutePath\(pathname\)/,
      'dispatcher must resolve the /api-relative route path interceptors register against',
    )
    assert.match(
      source,
      /from '@open-mercato\/shared\/lib\/crud\/dispatcher-interceptors'/,
      'dispatcher must import the shared interceptor bridge',
    )
  })
}
