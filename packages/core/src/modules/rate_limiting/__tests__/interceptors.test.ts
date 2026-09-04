import type { InterceptorContext, InterceptorRequest } from '@open-mercato/shared/lib/crud/api-interceptor'
import { loadControlPlanePrefixes, isControlPlaneRoute } from '../lib/controlPlane'
import { interceptors } from '../api/interceptors'

function makeContext(overrides: Partial<InterceptorContext> & { rateLimiterService?: unknown } = {}): InterceptorContext {
  const container = {
    resolve: (token: string) => {
      if (token === 'rateLimiterService') return overrides.rateLimiterService
      throw new Error(`resolve(${token}) not stubbed`)
    },
  } as unknown as InterceptorContext['container']
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    em: {} as never,
    container,
    ...overrides,
  } as InterceptorContext
}

function makeRequest(partial: Partial<InterceptorRequest> = {}): InterceptorRequest {
  return {
    method: 'POST',
    url: 'http://localhost/api/configs/system-status',
    headers: {},
    ...partial,
  } as InterceptorRequest
}

describe('rate_limiting controlPlane classification', () => {
  it('defaults and overrides env', () => {
    const prior = process.env.RATE_LIMIT_CONTROL_PLANE_PREFIXES
    delete process.env.RATE_LIMIT_CONTROL_PLANE_PREFIXES
    expect(loadControlPlanePrefixes()).toEqual(expect.any(Array))
    process.env.RATE_LIMIT_CONTROL_PLANE_PREFIXES = 'foo, bar/*'
    expect(isControlPlaneRoute('foo/baz')).toBe(true)
    expect(isControlPlaneRoute('bar/baz')).toBe(true)
    expect(isControlPlaneRoute('nope/baz')).toBe(false)
    if (prior === undefined) delete process.env.RATE_LIMIT_CONTROL_PLANE_PREFIXES
    else process.env.RATE_LIMIT_CONTROL_PLANE_PREFIXES = prior
  })

  it('classifies control-plane paths', () => {
    for (const path of ['configs/system-status', 'configs/', 'feature_toggles/list', 'admin/xyz']) {
      expect(isControlPlaneRoute(path)).toBe(true)
    }
    expect(isControlPlaneRoute('customers/list')).toBe(false)
    expect(isControlPlaneRoute('sales/orders')).toBe(false)
  })

  it('emits one interceptor per active prefix with explicit targetRoute', () => {
    expect(interceptors.length).toBeGreaterThan(0)
    for (const interceptor of interceptors) {
      expect(interceptor.targetRoute.endsWith('/*')).toBe(true)
      expect(interceptor.targetRoute.startsWith('*')).toBe(false)
      expect(interceptor.methods.length).toBe(5)
      expect(interceptor.priority).toBe(100)
      expect(interceptor.timeoutMs).toBeUndefined()
    }
  })

  it('allows within budget', async () => {
    const consume = jest.fn().mockResolvedValue({ allowed: true, remainingPoints: 119, msBeforeNext: 0, consumedPoints: 1 })
    const context = makeContext({ rateLimiterService: { consume, trustProxyDepth: 1 } as never })
    const result = await interceptors[0]!.before!(makeRequest(), context)
    expect(result.ok).toBe(true)
    expect(consume).toHaveBeenCalled()
  })

  it('blocks over budget with 429 and structured error body', async () => {
    const consume = jest.fn().mockResolvedValue({
      allowed: false,
      remainingPoints: 0,
      msBeforeNext: 3000,
      consumedPoints: 121,
    })
    const context = makeContext({ rateLimiterService: { consume, trustProxyDepth: 1 } as never })
    const result = await interceptors[0]!.before!(makeRequest(), context)
    expect(result.ok).toBe(false)
    expect(result.statusCode).toBe(429)
    expect(result.message).toBeTruthy()
    expect((result.errorBody ?? {}).retryAfter).toBe(3)
  })

  it('allows when the limiter service is unavailable (does not take control plane offline)', async () => {
    const context = makeContext() // no rateLimiterService in container
    const result = await interceptors[0]!.before!(makeRequest(), context)
    expect(result.ok).toBe(true)
  })
})
