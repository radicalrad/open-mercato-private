/* eslint-disable @typescript-eslint/no-require-imports */
import {
  detectConflicts,
  detectComponentOverrideConflicts,
  detectInterceptorConflicts,
  detectCircularWidgetDependencies,
  detectMissingFeatureDeclarations,
  detectUnmatchedInterceptorTargets,
} from '../conflict-detection'

describe('detectComponentOverrideConflicts', () => {
  it('returns no conflicts when no duplicates exist', () => {
    const result = detectComponentOverrideConflicts([
      { moduleId: 'a', componentId: 'page:home', priority: 100 },
      { moduleId: 'b', componentId: 'page:home', priority: 200 },
    ])
    expect(result).toHaveLength(0)
  })

  it('detects two modules replacing same component at same priority', () => {
    const result = detectComponentOverrideConflicts([
      { moduleId: 'a', componentId: 'page:home', priority: 100 },
      { moduleId: 'b', componentId: 'page:home', priority: 100 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
    expect(result[0].type).toBe('duplicate-component-override')
    expect(result[0].moduleIds).toContain('a')
    expect(result[0].moduleIds).toContain('b')
  })

  it('allows same module to override same component at same priority', () => {
    const result = detectComponentOverrideConflicts([
      { moduleId: 'a', componentId: 'page:home', priority: 100 },
      { moduleId: 'a', componentId: 'page:home', priority: 100 },
    ])
    expect(result).toHaveLength(0)
  })
})

describe('detectInterceptorConflicts', () => {
  it('returns no conflicts when priorities differ', () => {
    const result = detectInterceptorConflicts([
      { moduleId: 'a', id: 'a.int', targetRoute: 'customers/people', methods: ['GET'], priority: 100 },
      { moduleId: 'b', id: 'b.int', targetRoute: 'customers/people', methods: ['GET'], priority: 200 },
    ])
    expect(result).toHaveLength(0)
  })

  it('warns on same route, method, and priority from different modules', () => {
    const result = detectInterceptorConflicts([
      { moduleId: 'a', id: 'a.int', targetRoute: 'customers/people', methods: ['GET'], priority: 100 },
      { moduleId: 'b', id: 'b.int', targetRoute: 'customers/people', methods: ['GET'], priority: 100 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warning')
    expect(result[0].type).toBe('duplicate-interceptor-priority')
  })

  it('does not conflict on different methods', () => {
    const result = detectInterceptorConflicts([
      { moduleId: 'a', id: 'a.int', targetRoute: 'customers/people', methods: ['GET'], priority: 100 },
      { moduleId: 'b', id: 'b.int', targetRoute: 'customers/people', methods: ['POST'], priority: 100 },
    ])
    expect(result).toHaveLength(0)
  })
})

describe('detectCircularWidgetDependencies', () => {
  it('returns no conflicts for acyclic dependencies', () => {
    const result = detectCircularWidgetDependencies([
      { moduleId: 'a', spotId: 'spot-1', widgetId: 'w1', dependsOn: ['w2'] },
      { moduleId: 'a', spotId: 'spot-2', widgetId: 'w2', dependsOn: ['w3'] },
      { moduleId: 'a', spotId: 'spot-3', widgetId: 'w3' },
    ])
    expect(result).toHaveLength(0)
  })

  it('detects circular dependency', () => {
    const result = detectCircularWidgetDependencies([
      { moduleId: 'a', spotId: 'spot-1', widgetId: 'w1', dependsOn: ['w2'] },
      { moduleId: 'a', spotId: 'spot-2', widgetId: 'w2', dependsOn: ['w1'] },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
    expect(result[0].type).toBe('circular-widget-dependency')
  })
})

describe('detectMissingFeatureDeclarations', () => {
  it('returns no conflicts when all features are declared', () => {
    const result = detectMissingFeatureDeclarations(
      [{ moduleId: 'a', extensionId: 'a.widget', features: ['a.view'] }],
      new Set(['a.view']),
    )
    expect(result).toHaveLength(0)
  })

  it('warns on undeclared features', () => {
    const result = detectMissingFeatureDeclarations(
      [{ moduleId: 'a', extensionId: 'a.widget', features: ['a.admin'] }],
      new Set(['a.view']),
    )
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warning')
    expect(result[0].type).toBe('missing-feature-declaration')
  })
})

describe('detectConflicts (integration)', () => {
  it('aggregates errors and warnings correctly', () => {
    const result = detectConflicts({
      componentOverrides: [
        { moduleId: 'a', componentId: 'page:home', priority: 100 },
        { moduleId: 'b', componentId: 'page:home', priority: 100 },
      ],
      interceptors: [
        { moduleId: 'a', id: 'a.int', targetRoute: 'api/test', methods: ['GET'], priority: 50 },
        { moduleId: 'b', id: 'b.int', targetRoute: 'api/test', methods: ['GET'], priority: 50 },
      ],
      gatedExtensions: [
        { moduleId: 'c', extensionId: 'c.widget', features: ['c.missing'] },
      ],
      declaredFeatures: new Set(['a.view']),
    })

    expect(result.errors).toHaveLength(1)
    expect(result.warnings).toHaveLength(2)
  })
})

describe('detectUnmatchedInterceptorTargets (DARAA-100 remedy 2)', () => {
  const served = ['nemo-assets/verify', 'nemo-assets', 'auth/login']

  it('warns when a targetRoute matches no served route', () => {
    const result = detectUnmatchedInterceptorTargets(
      [{ moduleId: 'nemo_asset', id: 'a.typo', targetRoute: 'nemo-asset/verify', methods: ['POST'], priority: 0 }],
      served,
    )
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warning')
    expect(result[0].type).toBe('unmatched-interceptor-target')
    expect(result[0].message).toContain('never execute')
  })

  it('accepts an exact match', () => {
    const result = detectUnmatchedInterceptorTargets(
      [{ moduleId: 'nemo_asset', id: 'a.ok', targetRoute: 'nemo-assets/verify', methods: ['POST'], priority: 0 }],
      served,
    )
    expect(result).toHaveLength(0)
  })

  it('accepts a wildcard prefix match and a global wildcard', () => {
    const result = detectUnmatchedInterceptorTargets(
      [
        { moduleId: 'm', id: 'a.prefix', targetRoute: 'nemo-assets/*', methods: ['POST'], priority: 0 },
        { moduleId: 'm', id: 'a.global', targetRoute: '*', methods: ['POST'], priority: 0 },
      ],
      served,
    )
    expect(result).toHaveLength(0)
  })

  it('tolerates a leading /api prefix on either side', () => {
    const result = detectUnmatchedInterceptorTargets(
      [{ moduleId: 'm', id: 'a.api', targetRoute: '/api/auth/login', methods: ['POST'], priority: 0 }],
      served,
    )
    expect(result).toHaveLength(0)
  })

  it('skips the check when no served routes were discovered', () => {
    const result = detectUnmatchedInterceptorTargets(
      [{ moduleId: 'm', id: 'a.any', targetRoute: 'whatever', methods: ['POST'], priority: 0 }],
      [],
    )
    expect(result).toHaveLength(0)
  })

  it('is wired into detectConflicts only when servedApiRoutePaths is supplied', () => {
    const interceptors = [
      { moduleId: 'm', id: 'a.typo', targetRoute: 'does/not/exist', methods: ['POST'], priority: 0 },
    ]
    expect(
      detectConflicts({ interceptors }).warnings.filter((w) => w.type === 'unmatched-interceptor-target'),
    ).toHaveLength(0)
    expect(
      detectConflicts({ interceptors, servedApiRoutePaths: served }).warnings.filter(
        (w) => w.type === 'unmatched-interceptor-target',
      ),
    ).toHaveLength(1)
  })
})
