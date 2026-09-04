import type { AwilixContainer } from 'awilix'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ParsedExtensionHeaders } from '../umes/extension-headers'

export type ApiInterceptorMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type InterceptorRequest = {
  method: ApiInterceptorMethod
  url: string
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  headers: Record<string, string>
}

export type InterceptorResponse = {
  statusCode: number
  body: Record<string, unknown>
  headers: Record<string, string>
}

export type InterceptorContext = {
  userId: string
  organizationId: string
  tenantId: string
  em: EntityManager
  container: AwilixContainer
  userFeatures?: string[]
  metadata?: Record<string, unknown>
  extensionHeaders?: ParsedExtensionHeaders
}

export type InterceptorBeforeResult = {
  ok: boolean
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  headers?: Record<string, string>
  message?: string
  statusCode?: number
  metadata?: Record<string, unknown>
  /**
   * Structured error payload for a blocked (`ok: false`) result.
   *
   * Historically a block collapsed to `{ error: message }` and every other key an
   * interceptor produced was discarded, so an interceptor could never emit a
   * structured error contract (e.g. a `fields: [...]` validation array) or an
   * i18n-resolved payload. Keys supplied here are merged into the rejection body.
   *
   * `error` defaults to `message` (then a generic constant) when `errorBody` does
   * not provide one, so existing `{ ok: false, message }` interceptors are
   * unaffected. Ignored when `ok` is `true`.
   */
  errorBody?: Record<string, unknown>
}

export type InterceptorAfterResult = {
  merge?: Record<string, unknown>
  replace?: Record<string, unknown>
}

export type ApiInterceptor = {
  id: string
  targetRoute: string
  methods: ApiInterceptorMethod[]
  priority?: number
  features?: string[]
  timeoutMs?: number
  before?: (request: InterceptorRequest, context: InterceptorContext) => Promise<InterceptorBeforeResult>
  after?: (
    request: InterceptorRequest,
    response: InterceptorResponse,
    context: InterceptorContext,
  ) => Promise<InterceptorAfterResult>
}

export type ApiInterceptorRegistryEntry = {
  moduleId: string
  interceptor: ApiInterceptor
  moduleOrder: number
  interceptorOrder: number
}
