/**
 * Control-plane route classification for the rate-limiting overlay.
 *
 * The "control plane" is the management surface of Open Mercato — the routes that
 * administrate the tenant (config, feature toggles, API keys, audit logs, core
 * admin) as opposed to the high-volume data plane (records, lists, search).
 *
 * We deliberately avoid a hard-coded allowlist in core: the overlay keeps the
 * set configurable via `RATE_LIMIT_CONTROL_PLANE_PREFIXES` (comma-separated
 * `/api`-relative prefixes, trailing `/*` wildcard support) and falls back to a
 * conservative default set below.
 */

export const DEFAULT_CONTROL_PLANE_PREFIXES = [
  'admin',
  'configs',
  'core',
  'api_keys',
  'feature_toggles',
  'feature-toggles',
  'audit_logs',
  'audit-logs',
  'business_rules',
  'business-rules',
  'data_sync',
  'dashboards',
  'integrations', // integration setup/wiring is control-plane
  'portal', // portal domain management
  'query_index', // query index rebuild
]

export function loadControlPlanePrefixes(): string[] {
  const raw = process.env.RATE_LIMIT_CONTROL_PLANE_PREFIXES
  return raw && raw.trim() ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_CONTROL_PLANE_PREFIXES
}

/**
 * Decide whether a normalized `/api`-relative route path belongs to the control plane.
 * A prefix in the set matches the route exactly or as a `/*` wildcard.
 */
export function isControlPlaneRoute(routePath: string): boolean {
  const normalized = routePath.replace(/^\/+/, '').replace(/\/+$/, '')
  // exact route-path match against prefix list
  return loadControlPlanePrefixes().some((prefix) => {
    const p = prefix.replace(/^\/+/, '').replace(/\/+$/, '')
    if (p.endsWith('*')) {
      const base = p.slice(0, -1).replace(/\/+$/, '')
      return normalized === base || normalized.startsWith(`${base}/`) || normalized.startsWith(base)
    }
    return normalized === p || normalized.startsWith(`${p}/`)
  })
}
