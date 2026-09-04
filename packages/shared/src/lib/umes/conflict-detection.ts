import type { UmesConflict, UmesConflictResult } from './devtools-types'

export interface ComponentOverrideInput {
  moduleId: string
  componentId: string
  priority: number
}

export interface InterceptorInput {
  moduleId: string
  id: string
  targetRoute: string
  methods: string[]
  priority: number
}

export interface InjectionTableInput {
  moduleId: string
  spotId: string
  widgetId: string
  dependsOn?: string[]
}

export interface GatedExtensionInput {
  moduleId: string
  extensionId: string
  features: string[]
}

export interface ConflictDetectionInput {
  componentOverrides?: ComponentOverrideInput[]
  injectionTables?: InjectionTableInput[]
  interceptors?: InterceptorInput[]
  gatedExtensions?: GatedExtensionInput[]
  declaredFeatures?: Set<string>
  /**
   * Every `/api`-relative route path served by an enabled module. When supplied,
   * interceptor `targetRoute` values are validated against it so a typo'd or stale
   * target is reported at build time instead of silently never matching
   * (DARAA-100 remedy 2). Omit to skip the check.
   */
  servedApiRoutePaths?: string[]
}

/** Mirrors `routeMatches` in `lib/crud/interceptor-registry`. */
function interceptorTargetMatches(targetRoute: string, routePath: string): boolean {
  if (targetRoute === '*') return true
  if (targetRoute.endsWith('/*')) {
    const prefix = targetRoute.slice(0, -2)
    return routePath === prefix || routePath.startsWith(`${prefix}/`)
  }
  return targetRoute === routePath
}

function normalizeServedRoutePath(routePath: string): string {
  const trimmed = routePath.trim()
  const withoutApi = trimmed.startsWith('/api/')
    ? trimmed.slice(5)
    : trimmed === '/api'
      ? ''
      : trimmed
  return withoutApi.replace(/^\/+/, '').replace(/\/+$/, '')
}

/**
 * Warn when an interceptor's `targetRoute` does not resolve to any route served by
 * an enabled module. Such an interceptor looks active in the registry and passes
 * unit tests, but can never execute at runtime — the misconfiguration half of the
 * DARAA-100 fail-open class. Warning (not error) so a module targeting a route from
 * an optional/disabled peer module does not break the build.
 */
export function detectUnmatchedInterceptorTargets(
  interceptors: InterceptorInput[],
  servedApiRoutePaths: string[],
): UmesConflict[] {
  const conflicts: UmesConflict[] = []
  const served = servedApiRoutePaths.map(normalizeServedRoutePath).filter((entry) => entry.length > 0)
  // No discovered routes at all → the caller has nothing to validate against.
  if (served.length === 0) return conflicts

  for (const interceptor of interceptors) {
    const target = normalizeServedRoutePath(interceptor.targetRoute ?? '')
    if (!target) continue
    if (target === '*') continue
    if (served.some((routePath) => interceptorTargetMatches(target, routePath))) continue
    conflicts.push({
      severity: 'warning',
      type: 'unmatched-interceptor-target',
      message: `Interceptor "${interceptor.id}" in module "${interceptor.moduleId}" targets route "${interceptor.targetRoute}", which is not served by any enabled module — it will never execute. Check for a typo, a disabled module, or a missing leading path segment.`,
      moduleIds: [interceptor.moduleId],
      target: interceptor.targetRoute,
      details: { interceptorId: interceptor.id, targetRoute: interceptor.targetRoute },
    })
  }

  return conflicts
}

export function detectComponentOverrideConflicts(
  overrides: ComponentOverrideInput[],
): UmesConflict[] {
  const conflicts: UmesConflict[] = []
  const byComponentAndPriority = new Map<string, ComponentOverrideInput[]>()

  for (const override of overrides) {
    const key = `${override.componentId}\0${override.priority}`
    const existing = byComponentAndPriority.get(key)
    if (existing) {
      existing.push(override)
    } else {
      byComponentAndPriority.set(key, [override])
    }
  }

  for (const [, entries] of byComponentAndPriority) {
    if (entries.length > 1) {
      const moduleIds = [...new Set(entries.map((e) => e.moduleId))]
      if (moduleIds.length > 1) {
        conflicts.push({
          severity: 'error',
          type: 'duplicate-component-override',
          message: `Conflict: modules ${moduleIds.join(' and ')} both replace component "${entries[0].componentId}" at priority ${entries[0].priority}`,
          moduleIds,
          target: entries[0].componentId,
          details: { priority: entries[0].priority },
        })
      }
    }
  }

  return conflicts
}

export function detectInterceptorConflicts(
  interceptors: InterceptorInput[],
): UmesConflict[] {
  const conflicts: UmesConflict[] = []
  const byRouteMethodPriority = new Map<string, InterceptorInput[]>()

  for (const interceptor of interceptors) {
    for (const method of interceptor.methods) {
      const key = `${interceptor.targetRoute}\0${method}\0${interceptor.priority}`
      const existing = byRouteMethodPriority.get(key)
      if (existing) {
        existing.push(interceptor)
      } else {
        byRouteMethodPriority.set(key, [interceptor])
      }
    }
  }

  for (const [key, entries] of byRouteMethodPriority) {
    if (entries.length > 1) {
      const [route, method] = key.split('\0')
      const moduleIds = [...new Set(entries.map((e) => e.moduleId))]
      if (moduleIds.length > 1) {
        conflicts.push({
          severity: 'warning',
          type: 'duplicate-interceptor-priority',
          message: `Multiple interceptors on ${method.toUpperCase()} ${route} at priority ${entries[0].priority}: ${moduleIds.join(', ')}`,
          moduleIds,
          target: `${method.toUpperCase()} ${route}`,
          details: { priority: entries[0].priority, method, route },
        })
      }
    }
  }

  return conflicts
}

export function detectCircularWidgetDependencies(
  tables: InjectionTableInput[],
): UmesConflict[] {
  const conflicts: UmesConflict[] = []
  const graph = new Map<string, string[]>()

  for (const entry of tables) {
    if (entry.dependsOn && entry.dependsOn.length > 0) {
      const existing = graph.get(entry.widgetId) ?? []
      existing.push(...entry.dependsOn)
      graph.set(entry.widgetId, existing)
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(node: string, path: string[]): string[] | null {
    if (inStack.has(node)) {
      return [...path, node]
    }
    if (visited.has(node)) {
      return null
    }

    visited.add(node)
    inStack.add(node)

    const deps = graph.get(node) ?? []
    for (const dep of deps) {
      const cycle = dfs(dep, [...path, node])
      if (cycle) return cycle
    }

    inStack.delete(node)
    return null
  }

  for (const widgetId of graph.keys()) {
    if (!visited.has(widgetId)) {
      const cycle = dfs(widgetId, [])
      if (cycle) {
        const cycleStart = cycle[cycle.length - 1]
        const cycleStartIdx = cycle.indexOf(cycleStart)
        const cyclePath = cycle.slice(cycleStartIdx)

        conflicts.push({
          severity: 'error',
          type: 'circular-widget-dependency',
          message: `Circular widget dependency: ${cyclePath.join(' -> ')}`,
          moduleIds: [],
          target: cyclePath.join(' -> '),
        })
        break
      }
    }
  }

  return conflicts
}

export function detectMissingFeatureDeclarations(
  gatedExtensions: GatedExtensionInput[],
  declaredFeatures: Set<string>,
): UmesConflict[] {
  const conflicts: UmesConflict[] = []

  for (const ext of gatedExtensions) {
    for (const feature of ext.features) {
      if (!declaredFeatures.has(feature)) {
        conflicts.push({
          severity: 'warning',
          type: 'missing-feature-declaration',
          message: `Extension "${ext.extensionId}" in module "${ext.moduleId}" references undeclared feature "${feature}"`,
          moduleIds: [ext.moduleId],
          target: ext.extensionId,
          details: { feature },
        })
      }
    }
  }

  return conflicts
}

export function detectConflicts(input: ConflictDetectionInput): UmesConflictResult {
  const allConflicts: UmesConflict[] = []

  if (input.componentOverrides) {
    allConflicts.push(...detectComponentOverrideConflicts(input.componentOverrides))
  }

  if (input.interceptors) {
    allConflicts.push(...detectInterceptorConflicts(input.interceptors))
    if (input.servedApiRoutePaths) {
      allConflicts.push(
        ...detectUnmatchedInterceptorTargets(input.interceptors, input.servedApiRoutePaths),
      )
    }
  }

  if (input.injectionTables) {
    allConflicts.push(...detectCircularWidgetDependencies(input.injectionTables))
  }

  if (input.gatedExtensions && input.declaredFeatures) {
    allConflicts.push(
      ...detectMissingFeatureDeclarations(input.gatedExtensions, input.declaredFeatures),
    )
  }

  return {
    errors: allConflicts.filter((c) => c.severity === 'error'),
    warnings: allConflicts.filter((c) => c.severity === 'warning'),
  }
}
