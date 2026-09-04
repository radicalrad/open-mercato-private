# rate_limiting

Interceptor overlay that bounds authenticated **control-plane** (management) API
traffic beyond auth — one issue, one branch, no `src/modules` core modification
(ADR-0029, zero-core rule).

## What it does

Auth answers *who may act*. This overlay answers *how often an authenticated caller
may hit management endpoints* before the request is rejected with `429` so a
compromised/buggy tenant or user cannot storm config, feature-toggle,
integration-wiring, audit, or core admin surfaces and degrade the whole control
plane.

It emits one `ApiInterceptor` per control-plane prefix. Each runs with `priority 100`
(above business interceptors) and a `before` hook that consumes from the shared
`RateLimiterService` (memory or redis strategy), keyed by
`tenantId:userId:route` so tenants never share a budget — the lost-update-proof
`rate-limiter-flexible` window is used.

Fail-closed/timeout-safe: the framework wraps `before` in a timeout and turns
infrastructure failures into `500`. If the shared `rateLimiterService` cannot be
resolved the hook logs and allows the request so the mitigation never takes the
control plane offline.

## Module layout

```
packages/core/src/modules/rate_limiting/
├── index.ts                 # ModuleInfo metadata + features
├── acl.ts                  # Feature definitions (operational, no user perms)
├── api/interceptors.ts      # THE deliverable: control-plane rate-limit interceptors
├── lib/controlPlane.ts     # Control-plane route classification (env overridable)
└── README.md               # This file
```

No entities, events, workers or DI registrations — the module only contributes
interceptors. Register with `yarn generate` (auto-discovers `api/interceptors.ts`).

## Configuration (env)

| Variable | Default | Meaning |
|----------|---------|---------|
| `RATE_LIMIT_ENABLED` | `true` | Global kill-switch (shared with all rate limiters); `false` disables |
| `RATE_LIMIT_STRATEGY` | `memory` | `memory` or `redis` (shared config) |
| `RATE_LIMIT_KEY_PREFIX` | `rl` | Shared key prefix |
| `RATE_LIMIT_TRUST_PROXY_DEPTH` | `1` | Proxy depth for IP extraction (unused here; future IP keying) |
| `RATE_LIMIT_CONTROL_PLANE_POINTS` | `120` | Max requests per window |
| `RATE_LIMIT_CONTROL_PLANE_DURATION` | `60` | Window seconds |
| `RATE_LIMIT_CONTROL_PLANE_BLOCK_DURATION` | `0` | Extra block seconds after exceeding (`0` = reject only) |
| `RATE_LIMIT_CONTROL_PLANE_PREFIXES` | see lib | Comma-separated `/api`-relative prefixes, `/*` wildcard supported |

Global limiters (`RATE_LIMIT_STRATEGY`, `RATE_LIMIT_KEY_PREFIX`, and the
per-endpoint `_POINTS/_DURATION/_BLOCK_DURATION`) are managed by the shared
`readEndpointRateLimitConfig` helper, matching the auth-metric conventions already in
the codebase.
