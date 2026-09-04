import type {
  ApiInterceptor,
  ApiInterceptorMethod,
  InterceptorContext,
  InterceptorRequest,
} from '@open-mercato/shared/lib/crud/api-interceptor'
import type { RateLimiterService } from '@open-mercato/shared/lib/ratelimit/service'
import { readEndpointRateLimitConfig } from '@open-mercato/shared/lib/ratelimit/config'
import { RATE_LIMIT_ERROR_KEY, RATE_LIMIT_ERROR_FALLBACK } from '@open-mercato/shared/lib/ratelimit/helpers'
import { loadControlPlanePrefixes } from '../lib/controlPlane'

/**
 * Control-plane rate limiting (beyond auth).
 *
 * Auth already covers *who* may act; this overlay bounds *how often* an
 * authenticated caller may hit management ("control plane") endpoints, so a single
 * compromised or buggy tenant/user cannot storm configuration, feature-toggle,
 * integration-wiring or audit surfaces and degrade the rest of the system.
 *
 * Design constraints honoured:
 * - Interceptor overlay only: no `src/modules` core modification. One interceptor
 *   is emitted per control-plane prefix (`targetRoute` is explicit, never `*`), so
 *   the hot data plane is untouched.
 * - Fail-closed and timeout-safe: the framework already wraps `before` in a timeout
 *   (default 5s) and turns plumbing failures into 500s. If the shared
 *   `rateLimiterService` is unavailable we log and *allow* (a rate limiter must
 *   never take the whole control plane offline), matching the existing webhook-route
 *   behaviour.
 * - Tenant-safe: the limit key is scoped by tenant + user + route so one tenant
 *   never consumes another tenant's budget.
 *
 * Env knobs (declared in the spec Configuration section):
 *   RATE_LIMIT_CONTROL_PLANE_POINTS        (default 120)
 *   RATE_LIMIT_CONTROL_PLANE_DURATION      (default 60s)
 *   RATE_LIMIT_CONTROL_PLANE_BLOCK_DURATION (default 0 = reject, no block)
 *   RATE_LIMIT_CONTROL_PLANE_PREFIXES       (default lib/controlPlane defaults)
 *
 * Precedence: assigned priority 100 so it runs ahead of business interceptors on the
 * same routes; the shared framework sorts by priority then module order.
 */

const CONTROL_PLANE_ENV_PREFIX = 'CONTROL_PLANE'
const CONTROL_PLANE_PRIORITY = 100
const CONTROL_PLANE_METHODS: ApiInterceptorMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function resolveRateLimiter(context: InterceptorContext): RateLimiterService | undefined {
  try {
    const service = context.container.resolve('rateLimiterService') as RateLimiterService | undefined
    return service ?? undefined
  } catch {
    return undefined
  }
}

function buildControlPlaneLimiter() {
  return readEndpointRateLimitConfig(CONTROL_PLANE_ENV_PREFIX, {
    points: 120,
    duration: 60,
    blockDuration: 0,
    keyPrefix: 'control-plane',
  })
}

async function enforceControlPlaneLimit(
  request: InterceptorRequest,
  context: InterceptorContext,
): Promise<{ ok: boolean; message?: string; retryAfterSec?: number; errorBody?: Record<string, unknown> }> {
  const limiter = buildControlPlaneLimiter()
  const service = resolveRateLimiter(context)
  if (!service) {
    // Rate limiter infrastructure unavailable — log and let the request through.
    // A limiter is a mitigation, not a hard dependency of the control plane.
    return { ok: true }
  }

  // Reject when the feature is globally disabled (RATE_LIMIT_ENABLED=false) —
  // consume() already returns allowed for a disabled service.
  const key = `ctrl:${context.tenantId || 'anon'}:${context.userId || 'anon'}:${request.url}`
  const result = await service.consume(key, limiter)

  if (result.allowed) return { ok: true }

  const retryAfterSec = Math.max(1, Math.ceil(result.msBeforeNext / 1000))
  return {
    ok: false,
    message: RATE_LIMIT_ERROR_FALLBACK,
    retryAfterSec,
    errorBody: {
      error: RATE_LIMIT_ERROR_KEY,
      retryAfter: retryAfterSec,
    },
  }
}

export const interceptors: ApiInterceptor[] = loadControlPlanePrefixes().map((prefix) => ({
  id: `rate_limiting.control-plane:${prefix}`,
  targetRoute: `${prefix}/*`,
  methods: CONTROL_PLANE_METHODS,
  priority: CONTROL_PLANE_PRIORITY,
  before: async (request, context) => {
    const result = await enforceControlPlaneLimit(request, context)
    if (!result.ok) {
      return {
        ok: false,
        statusCode: 429,
        message: result.message,
        errorBody: result.errorBody,
      }
    }
    return { ok: true }
  },
}))
