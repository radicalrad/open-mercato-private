import type { AwilixContainer } from 'awilix'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ApiInterceptorMethod, InterceptorContext, InterceptorRequest } from './api-interceptor'
import { getApiInterceptorsForRoute } from './interceptor-registry'
import { runApiInterceptorsAfter, runApiInterceptorsBefore } from './interceptor-runner'
import { parseExtensionHeaders } from '../umes/extension-headers'
import { createLogger } from '../logger'

const logger = createLogger('shared').child({ component: 'dispatcher-interceptors' })

/**
 * Marker property set on route handlers that already drive the API interceptor
 * chain themselves (the CRUD factory, and hand-written routes that call
 * `runApiInterceptorsBefore` / `runCustomRouteAfterInterceptors` explicitly).
 *
 * The dispatcher consults this to avoid running the chain twice for the same
 * request. Anything NOT marked gets the chain run by the dispatcher, which is
 * what closes the DARAA-100 fail-open class: an interceptor registered against a
 * hand-written route used to look active in the registry but never execute.
 */
const SELF_MANAGED_KEY = '__openMercatoRunsApiInterceptors__'

/**
 * Declare that this handler runs the API interceptor chain itself, so the
 * dispatcher must not run it again. Returns the same handler for chaining.
 */
export function markHandlerRunsApiInterceptors<T>(handler: T): T {
  if (typeof handler === 'function' || (handler && typeof handler === 'object')) {
    try {
      Object.defineProperty(handler as object, SELF_MANAGED_KEY, {
        value: true,
        enumerable: false,
        configurable: true,
        writable: false,
      })
    } catch {
      // Frozen/exotic handler — fall back to dispatcher-driven interception.
      // Worst case is a duplicate run, never a skipped one (fail closed).
    }
  }
  return handler
}

/** True when the handler declared that it drives the interceptor chain itself. */
export function handlerRunsApiInterceptors(handler: unknown): boolean {
  if (!handler) return false
  if (typeof handler !== 'function' && typeof handler !== 'object') return false
  return (handler as Record<string, unknown>)[SELF_MANAGED_KEY] === true
}

/**
 * Normalize an incoming pathname to the route path interceptors register against
 * (`targetRoute` values are `/api`-relative, e.g. `staff/timesheets/time-entries`).
 */
export function normalizeDispatcherRoutePath(pathname: string): string {
  if (pathname.startsWith('/api/')) return pathname.slice(5)
  if (pathname === '/api') return ''
  return pathname.replace(/^\/+/, '')
}

export type DispatcherAuthLike = {
  sub: string
  tenantId?: string | null
  orgId?: string | null
} | null | undefined

type RbacServiceLike = {
  getGrantedFeatures?: (
    userId: string,
    scope: { tenantId?: string | null; organizationId?: string | null },
  ) => Promise<string[] | undefined>
}

const JSON_CONTENT_TYPE = 'application/json'

function contentTypeOf(headers: Headers): string {
  const raw = headers.get('content-type')
  if (!raw) return ''
  return raw.split(';')[0]!.trim().toLowerCase()
}

function toPlainHeaders(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {}
  headers.forEach((value, key) => {
    output[key] = value
  })
  return output
}

function queryFromUrl(url: URL): Record<string, unknown> {
  const query: Record<string, unknown> = {}
  url.searchParams.forEach((value, key) => {
    const existing = query[key]
    if (existing === undefined) {
      query[key] = value
      return
    }
    if (Array.isArray(existing)) {
      existing.push(value)
      return
    }
    query[key] = [existing, value]
  })
  return query
}

function methodCarriesBody(method: string): boolean {
  const upper = method.toUpperCase()
  return upper !== 'GET' && upper !== 'HEAD' && upper !== 'OPTIONS'
}

async function readJsonRecord(source: Request | Response): Promise<Record<string, unknown> | undefined> {
  if (contentTypeOf(source.headers) !== JSON_CONTENT_TYPE) return undefined
  try {
    const parsed = await source.clone().json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Malformed or empty JSON — let the downstream handler deal with it.
  }
  return undefined
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

/** Rebuild a Request carrying the interceptor-rewritten body / query / headers. */
function applyRequestRewrites(
  original: Request,
  originalPayload: InterceptorRequest,
  rewritten: InterceptorRequest,
  routePath: string,
): Request {
  const bodyChanged = stableStringify(originalPayload.body) !== stableStringify(rewritten.body)
  const queryChanged = stableStringify(originalPayload.query) !== stableStringify(rewritten.query)
  const headersChanged = stableStringify(originalPayload.headers) !== stableStringify(rewritten.headers)
  if (!bodyChanged && !queryChanged && !headersChanged) return original

  const url = new URL(original.url)
  if (queryChanged) {
    url.search = ''
    for (const [key, value] of Object.entries(rewritten.query ?? {})) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const headers = new Headers(original.headers)
  if (headersChanged) {
    for (const [key, value] of Object.entries(rewritten.headers ?? {})) {
      if (value === undefined || value === null) continue
      headers.set(key, String(value))
    }
  }

  const init: RequestInit & { duplex?: string } = { method: original.method, headers }

  if (methodCarriesBody(original.method)) {
    if (bodyChanged) {
      // Body rewrites can only be materialized for JSON payloads. For any other
      // content type we must not silently drop the interceptor's intent.
      if (contentTypeOf(original.headers) !== JSON_CONTENT_TYPE) {
        logger.warn(
          'Interceptor rewrote the request body for a non-JSON route — rewrite not applied',
          { routePath, method: original.method, contentType: contentTypeOf(original.headers) },
        )
        return queryChanged || headersChanged
          ? new Request(url, { method: original.method, headers, body: original.clone().body, duplex: 'half' } as RequestInit)
          : original
      }
      headers.set('content-type', JSON_CONTENT_TYPE)
      init.body = JSON.stringify(rewritten.body ?? {})
    } else {
      init.body = original.clone().body
      init.duplex = 'half'
    }
  }

  return new Request(url, init as RequestInit)
}

async function resolveUserFeatures(
  container: AwilixContainer,
  auth: NonNullable<DispatcherAuthLike>,
  organizationId: string | null,
): Promise<string[] | undefined> {
  try {
    const rbac = container.resolve('rbacService') as RbacServiceLike | undefined
    if (rbac?.getGrantedFeatures) {
      return await rbac.getGrantedFeatures(auth.sub, {
        tenantId: auth.tenantId ?? null,
        organizationId: organizationId ?? auth.orgId ?? null,
      })
    }
  } catch {
    // rbacService unavailable — interceptors without `features` still run.
  }
  return undefined
}

export type DispatcherInterceptorArgs = {
  /** `/api`-relative route path, e.g. `nemo-assets/verify`. */
  routePath: string
  method: ApiInterceptorMethod
  request: Request
  /** The resolved route handler — used to detect self-managed interceptor chains. */
  handler: unknown
  auth: DispatcherAuthLike
  /** Organization scope already resolved by the dispatcher, when available. */
  organizationId?: string | null
  resolveContainer: () => Promise<AwilixContainer>
  /** Invokes the route handler with the (possibly rewritten) request. */
  run: (request: Request) => Promise<Response>
}

/**
 * Run the registered API interceptor chain around a module route handler.
 *
 * This is the dispatcher-side counterpart to the CRUD factory's built-in chain.
 * Before DARAA-100 only `makeCrudRoute` invoked interceptors, so any hand-written
 * route relying on a registered interceptor for a security control was silently
 * fail-open. Behaviour:
 *
 * - No interceptors registered for the route+method → the handler runs untouched
 *   (zero added work on the hot path, no container creation).
 * - Handler marked self-managed → skipped here to avoid a double run.
 * - `before` blocks → the interceptor's status + structured body is returned and
 *   the handler never runs.
 * - `before` rewrites body/query/headers → the handler receives the rewritten request.
 * - `after` runs against JSON responses and may merge/replace the payload.
 * - Any plumbing failure fails CLOSED (500) rather than silently bypassing the chain.
 */
export async function withDispatcherApiInterceptors(args: DispatcherInterceptorArgs): Promise<Response> {
  const { routePath, method, request, handler } = args

  if (getApiInterceptorsForRoute(routePath, method).length === 0) {
    return args.run(request)
  }

  // The handler already drives the chain (CRUD factory, or an explicit call).
  if (handlerRunsApiInterceptors(handler)) {
    return args.run(request)
  }

  // Interceptor context requires an authenticated actor. Public routes keep their
  // existing behaviour; interceptors are an authenticated-surface extension point.
  if (!args.auth) {
    return args.run(request)
  }
  const auth = args.auth

  let container: AwilixContainer
  let em: EntityManager
  try {
    container = await args.resolveContainer()
    em = container.resolve('em') as EntityManager
  } catch (error) {
    logger.error('Failed to build interceptor context — failing closed', {
      routePath,
      method,
      err: error instanceof Error ? error : new Error(String(error)),
    })
    return Response.json({ error: 'Internal interceptor error' }, { status: 500 })
  }

  const url = new URL(request.url)
  const organizationId = args.organizationId ?? auth.orgId ?? ''
  const headers = toPlainHeaders(request.headers)
  const requestPayload: InterceptorRequest = {
    method,
    url: request.url,
    body: methodCarriesBody(request.method) ? await readJsonRecord(request) : undefined,
    query: queryFromUrl(url),
    headers,
  }

  const context: Omit<InterceptorContext, 'metadata'> = {
    userId: auth.sub,
    organizationId,
    tenantId: auth.tenantId ?? '',
    em,
    container,
    userFeatures: await resolveUserFeatures(container, auth, args.organizationId ?? null),
    extensionHeaders: parseExtensionHeaders(headers),
  }

  const before = await runApiInterceptorsBefore({ routePath, method, request: requestPayload, context })
  if (!before.ok) {
    return Response.json(before.body, { status: before.statusCode })
  }

  const effectiveRequest = applyRequestRewrites(request, requestPayload, before.request, routePath)
  const response = await args.run(effectiveRequest)

  // `after` only applies to JSON payloads; streams, redirects and file downloads
  // pass through untouched.
  const responseBody = await readJsonRecord(response)
  if (responseBody === undefined) return response

  const after = await runApiInterceptorsAfter({
    routePath,
    method,
    request: before.request,
    response: {
      statusCode: response.status,
      body: responseBody,
      headers: toPlainHeaders(response.headers),
    },
    context,
    metadataByInterceptor: before.metadataByInterceptor,
  })

  const finalHeaders = new Headers(response.headers)
  for (const [key, value] of Object.entries(after.headers ?? {})) {
    if (value === undefined || value === null) continue
    finalHeaders.set(key, String(value))
  }
  // Body is re-serialized below; a stale length would corrupt the response.
  finalHeaders.delete('content-length')
  finalHeaders.set('content-type', JSON_CONTENT_TYPE)

  return new Response(JSON.stringify(after.body), {
    status: after.ok ? response.status : after.statusCode,
    statusText: response.statusText,
    headers: finalHeaders,
  })
}
