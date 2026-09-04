/**
 * DARAA-100 regression coverage.
 *
 * Problem 1 (fail-open class): the app dispatcher never consulted the interceptor
 * registry, so a registered interceptor targeting a hand-written route looked active
 * but never executed. `withDispatcherApiInterceptors` closes that.
 *
 * Problem 2: the interceptor runner's reject path collapsed a blocked result to
 * `{ error }` and dropped every other key, so an interceptor could never emit a
 * structured error contract.
 */
import { registerApiInterceptors } from '@open-mercato/shared/lib/crud/interceptor-registry'
import { runApiInterceptorsBefore } from '@open-mercato/shared/lib/crud/interceptor-runner'
import {
  handlerRunsApiInterceptors,
  markHandlerRunsApiInterceptors,
  normalizeDispatcherRoutePath,
  withDispatcherApiInterceptors,
} from '@open-mercato/shared/lib/crud/dispatcher-interceptors'
import type { ApiInterceptor, InterceptorContext } from '@open-mercato/shared/lib/crud/api-interceptor'

const AUTH = { sub: 'user-1', tenantId: 'tenant-1', orgId: 'org-1' }

function fakeContainer() {
  return {
    resolve: (key: string) => {
      if (key === 'em') return {}
      if (key === 'rbacService') return { getGrantedFeatures: async () => ['nemo.assets.manage'] }
      return null
    },
  } as unknown as InterceptorContext['container']
}

function register(interceptors: ApiInterceptor[]) {
  registerApiInterceptors([{ moduleId: 'nemo_asset', interceptors }])
}

function dispatch(args: {
  routePath: string
  method?: 'GET' | 'POST' | 'PATCH'
  request: Request
  handler?: unknown
  run: (req: Request) => Promise<Response>
  auth?: typeof AUTH | null
}) {
  return withDispatcherApiInterceptors({
    routePath: args.routePath,
    method: args.method ?? 'POST',
    request: args.request,
    handler: args.handler ?? (() => undefined),
    auth: args.auth === undefined ? AUTH : args.auth,
    resolveContainer: async () => fakeContainer(),
    run: args.run,
  })
}

function jsonRequest(url: string, body: unknown, method = 'POST') {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  registerApiInterceptors([])
})

describe('DARAA-100 problem 1 — dispatcher runs interceptors for hand-written routes', () => {
  test('a blocking interceptor stops a hand-written route from executing', async () => {
    register([
      {
        id: 'nemo.asset.verify.guard',
        targetRoute: 'nemo-assets/verify',
        methods: ['POST'],
        async before() {
          return { ok: false, statusCode: 403, message: 'Blocked by security control' }
        },
      },
    ])

    const handler = jest.fn(async () => Response.json({ ok: true }))
    const response = await dispatch({
      routePath: 'nemo-assets/verify',
      request: jsonRequest('http://localhost/api/nemo-assets/verify', { id: 'a1' }),
      run: handler,
    })

    // This is the SEC-01 fail-open regression: before the fix the handler ran anyway.
    expect(handler).not.toHaveBeenCalled()
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: 'Blocked by security control' })
  })

  test('an allowing interceptor lets the route run and can rewrite the request body', async () => {
    register([
      {
        id: 'nemo.asset.verify.rewrite',
        targetRoute: 'nemo-assets/verify',
        methods: ['POST'],
        async before(request) {
          return { ok: true, body: { ...(request.body ?? {}), injected: true } }
        },
      },
    ])

    let seenBody: unknown
    const response = await dispatch({
      routePath: 'nemo-assets/verify',
      request: jsonRequest('http://localhost/api/nemo-assets/verify', { id: 'a1' }),
      run: async (req) => {
        seenBody = await req.json()
        return Response.json({ ok: true })
      },
    })

    expect(seenBody).toEqual({ id: 'a1', injected: true })
    expect(response.status).toBe(200)
  })

  test('an after interceptor can merge into a hand-written route response', async () => {
    register([
      {
        id: 'nemo.asset.verify.after',
        targetRoute: 'nemo-assets/verify',
        methods: ['POST'],
        async after() {
          return { merge: { audited: true } }
        },
      },
    ])

    const response = await dispatch({
      routePath: 'nemo-assets/verify',
      request: jsonRequest('http://localhost/api/nemo-assets/verify', { id: 'a1' }),
      run: async () => Response.json({ ok: true }),
    })

    await expect(response.json()).resolves.toEqual({ ok: true, audited: true })
  })

  test('routes with no registered interceptor are untouched (and need no container)', async () => {
    const original = Response.json({ ok: true })
    const response = await withDispatcherApiInterceptors({
      routePath: 'unrelated/route',
      method: 'POST',
      request: jsonRequest('http://localhost/api/unrelated/route', {}),
      handler: () => undefined,
      auth: AUTH,
      resolveContainer: async () => {
        throw new Error('container must not be built when no interceptor matches')
      },
      run: async () => original,
    })

    expect(response).toBe(original)
  })

  test('self-managed handlers (CRUD factory / explicit callers) are not double-run', async () => {
    const before = jest.fn(async () => ({ ok: true }))
    register([
      { id: 'nemo.asset.selfmanaged', targetRoute: 'nemo-assets/verify', methods: ['POST'], before },
    ])

    const handler = markHandlerRunsApiInterceptors(jest.fn(async () => Response.json({ ok: true })))
    expect(handlerRunsApiInterceptors(handler)).toBe(true)

    await dispatch({
      routePath: 'nemo-assets/verify',
      request: jsonRequest('http://localhost/api/nemo-assets/verify', {}),
      handler,
      run: handler as unknown as (req: Request) => Promise<Response>,
    })

    // The handler drives the chain itself; the dispatcher must not run it again.
    expect(before).not.toHaveBeenCalled()
  })

  test('fails CLOSED with 500 when the interceptor context cannot be built', async () => {
    const before = jest.fn(async () => ({ ok: false, statusCode: 403, message: 'nope' }))
    register([
      { id: 'nemo.asset.ctxfail', targetRoute: 'nemo-assets/verify', methods: ['POST'], before },
    ])

    const handler = jest.fn(async () => Response.json({ ok: true }))
    const response = await withDispatcherApiInterceptors({
      routePath: 'nemo-assets/verify',
      method: 'POST',
      request: jsonRequest('http://localhost/api/nemo-assets/verify', {}),
      handler: () => undefined,
      auth: AUTH,
      resolveContainer: async () => {
        throw new Error('DI container unavailable')
      },
      run: handler,
    })

    expect(response.status).toBe(500)
    expect(handler).not.toHaveBeenCalled()
  })

  test('normalizeDispatcherRoutePath strips the /api prefix interceptors omit', () => {
    expect(normalizeDispatcherRoutePath('/api/nemo-assets/verify')).toBe('nemo-assets/verify')
    expect(normalizeDispatcherRoutePath('/nemo-assets/verify')).toBe('nemo-assets/verify')
    expect(normalizeDispatcherRoutePath('/api')).toBe('')
  })
})

describe('DARAA-100 problem 2 — rejectBody preserves structured error detail', () => {
  const context = {
    userId: 'user-1',
    organizationId: 'org-1',
    tenantId: 'tenant-1',
    em: {} as InterceptorContext['em'],
    container: fakeContainer(),
    userFeatures: [],
  }

  function runBefore() {
    return runApiInterceptorsBefore({
      routePath: 'nemo-assets/verify',
      method: 'POST',
      request: { method: 'POST', url: 'http://localhost/api/nemo-assets/verify', headers: {} },
      context,
    })
  }

  test('keys supplied via errorBody survive the block', async () => {
    register([
      {
        id: 'nemo.asset.structured',
        targetRoute: 'nemo-assets/verify',
        methods: ['POST'],
        async before() {
          return {
            ok: false,
            statusCode: 422,
            errorBody: {
              error: 'Validation failed',
              code: 'NEMO_VERIFY_INVALID',
              fields: [{ path: 'serial', message: 'Serial is required' }],
            },
          }
        },
      },
    ])

    const result = await runBefore()
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected block')
    expect(result.statusCode).toBe(422)
    expect(result.body).toMatchObject({
      error: 'Validation failed',
      code: 'NEMO_VERIFY_INVALID',
      fields: [{ path: 'serial', message: 'Serial is required' }],
    })
  })

  test('legacy `{ ok: false, message }` interceptors keep the old shape', async () => {
    register([
      {
        id: 'nemo.asset.legacy',
        targetRoute: 'nemo-assets/verify',
        methods: ['POST'],
        async before() {
          return { ok: false, statusCode: 403, message: 'Forbidden by policy' }
        },
      },
    ])

    const result = await runBefore()
    if (result.ok) throw new Error('expected block')
    expect(result.statusCode).toBe(403)
    expect(result.body.error).toBe('Forbidden by policy')
  })

  test('errorBody may override `error` with an i18n-resolved message', async () => {
    register([
      {
        id: 'nemo.asset.i18n',
        targetRoute: 'nemo-assets/verify',
        methods: ['POST'],
        async before() {
          return {
            ok: false,
            statusCode: 403,
            message: 'fallback constant',
            errorBody: { error: 'Zasób jest zablokowany', locale: 'pl' },
          }
        },
      },
    ])

    const result = await runBefore()
    if (result.ok) throw new Error('expected block')
    expect(result.body.error).toBe('Zasób jest zablokowany')
    expect(result.body.locale).toBe('pl')
  })
})
