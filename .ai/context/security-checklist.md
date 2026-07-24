# Security Checklist

Purpose: Security considerations shared across Architect, Implementation Engineer, and Security Reviewer. Updated at spec time (shifted-left), not just at audit time.

## Format

Each entry:
```
### [YYYY-MM-DD] Security Consideration for Feature X
- **Issue:** DARAA-XX
- **Added by:** Agent role (Architect / Implementer / Security Reviewer)
- **Status:** pending | in_progress | resolved
- **Description:** What needs to be verified/secured
- **Evidence:** Link to proof of resolution (PR, test, audit)
```

## Shifted-Left Protocol

1. **At spec time (Architect):** Review this file for known risks before finalizing spec
2. **At implementation time (Implementer):** Check off items you address; add new items discovered
3. **At review time (Security Reviewer):** Verify all checklist items have evidence; add missed items

## Entries

### [2026-07-24] Dev compose JWT_SECRET weak default
- **Issue:** DARAA-14
- **Added by:** Security Reviewer
- **Status:** pending
- **Description:** podman-compose.dev.yml defaults JWT_SECRET to "JWT". Must be removed or replaced with required marker before merge. Any environment using this default has forgeable auth tokens.
- **Evidence:** Security audit finding F1 (CRITICAL)

### [2026-07-24] Dev compose superadmin password default
- **Issue:** DARAA-14
- **Added by:** Security Reviewer
- **Status:** pending
- **Description:** podman-compose.dev.yml defaults OM_INIT_SUPERADMIN_PASSWORD to "password". Should require explicit override.
- **Evidence:** Security audit finding F2 (HIGH)

### [2026-07-24] Dev compose app container runs as root
- **Issue:** DARAA-14
- **Added by:** Security Reviewer
- **Status:** pending
- **Description:** podman-compose.dev.yml sets user: "0" on the app container, contradicting the deploy README claim of non-root containers. Needs justification or fix.
- **Evidence:** Security audit finding F3 (HIGH)

### [2026-07-24] Dev compose tenant encryption fallback key hardcoded
- **Issue:** DARAA-14
- **Added by:** Security Reviewer
- **Status:** pending
- **Description:** podman-compose.dev.yml hardcodes a known fallback encryption key. Data encrypted with this key has zero security.
- **Evidence:** Security audit finding F4 (MEDIUM)

### [2026-07-24] Dev compose ports bound to 0.0.0.0
- **Issue:** DARAA-14
- **Added by:** Security Reviewer
- **Status:** pending
- **Description:** Dev compose binds ports to all interfaces instead of 127.0.0.1 like local/prod compose files.
- **Evidence:** Security audit finding F5 (MEDIUM)

### [2026-07-24] Redis has no authentication in any environment
- **Issue:** DARAA-14
- **Added by:** Security Reviewer
- **Status:** pending
- **Description:** All compose files run Redis without requirepass. Defense-in-depth gap.
- **Evidence:** Security audit finding F6 (MEDIUM)

### [2026-07-24] Prod compose init-db.sql is empty directory
- **Issue:** DARAA-14
- **Added by:** Security Reviewer
- **Status:** pending
- **Description:** deploy/scripts/init-db.sql is a directory, not a file. The prod compose mount will fail.
- **Evidence:** Security audit finding F9 (BUG)

### [2026-07-24] DATABASE_URL syntax broken in all compose files
- **Issue:** DARAA-22
- **Added by:** Implementation Engineer
- **Status:** resolved
- **Description:** All three podman-compose files had invalid DATABASE_URL syntax: `${POSTGRES_USER:***` instead of `${POSTGRES_USER}:${POSTGRES_PASSWORD}`. Deployment would fail with connection errors.
- **Evidence:** prod/local/dev compose files now use the correct two-variable substitution; `podman-compose config` resolves DATABASE_URL cleanly.

### [2026-07-24] Missing superadmin initialization in prod compose
- **Issue:** DARAA-22
- **Added by:** Implementation Engineer
- **Status:** resolved
- **Description:** Prod compose was missing OM_INIT_SUPERADMIN_EMAIL and OM_INIT_SUPERADMIN_PASSWORD variables. Superadmin could not be auto-created on first run.
- **Evidence:** prod compose now has both vars (email defaults to superadmin@acme.com, password is required via `?` marker). env.production.template and deploy/README.md updated.

### [2026-07-24] Weak defaults in dev compose (JWT, superadmin password)
- **Issue:** DARAA-22
- **Added by:** Implementation Engineer
- **Status:** resolved
- **Description:** Dev compose defaulted JWT_SECRET to "JWT" and OM_INIT_SUPERADMIN_PASSWORD to "password". If copied to a production-like environment, auth tokens are forgeable and the superadmin credential is known.
- **Evidence:** Both replaced with required-marker syntax that fails at `up` time. Deploy README documents `openssl rand` commands for generating values.

### [2026-07-24] Empty init-db.sql directory caused mount failure
- **Issue:** DARAA-22
- **Added by:** Implementation Engineer
- **Status:** resolved
- **Description:** `deploy/scripts/init-db.sql` was an empty directory but prod compose mounted it as a file, which would fail at first postgres container start.
- **Evidence:** Volume mount removed from prod compose; empty directory deleted. If a real init script is needed later, it can be added as a proper file.

