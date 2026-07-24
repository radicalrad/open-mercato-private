# DARAA-22: Fix Deployment - Implementation Plan

## Issue Summary
Application deployment is broken due to critical syntax errors in podman-compose files, missing initialization configuration, and security issues with default credentials.

## Root Cause Analysis

### Critical Bug: DATABASE_URL Syntax Error
**All three podman-compose files have invalid DATABASE_URL syntax:**
- `deploy/podman-compose.prod.yml:78` - `DATABASE_URL: postgresql://${POSTGRES_USER:***@postgres:5432/open_mercato`
- `deploy/podman-compose.local.yml:74` - `DATABASE_URL: postgresql://${POSTGRES_USER:***@postgres:5432/open_mercato`
- `deploy/podman-compose.dev.yml:107` - `DATABASE_URL: postgres://${POSTGRES_USER:***@om-postgres-dev:5432/${POSTGRES_DB:-open-mercato}`

**Problem:** The syntax `${POSTGRES_USER:***` is invalid Docker Compose variable substitution. The `:***` appears to be an attempt to mask the password in the file, but this breaks the variable expansion.

**Correct syntax:** `${POSTGRES_USER}:${POSTGRES_PASSWORD}`

### Secondary Issues

1. **init-db.sql is a directory, not a file** (prod compose line 23)
   - `deploy/scripts/init-db.sql/` is an empty directory
   - Volume mount `./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro` will fail

2. **Missing superadmin initialization in prod compose**
   - Dev compose has `OM_INIT_SUPERADMIN_EMAIL` and `OM_INIT_SUPERADMIN_PASSWORD`
   - Prod compose is missing these variables entirely
   - Superadmin cannot be auto-created on first run

3. **Security: Weak defaults in dev compose**
   - `JWT_SECRET: ${JWT_SECRET:-JWT}` - Forgeable auth tokens (CRITICAL)
   - `OM_INIT_SUPERADMIN_PASSWORD: ${OM_INIT_SUPERADMIN_PASSWORD:-password}` - Default password (HIGH)

---

## Implementation Plan

### Phase 1: Fix Critical DATABASE_URL Syntax (All Environments)

**Files to modify:**
- `deploy/podman-compose.prod.yml`
- `deploy/podman-compose.local.yml`
- `deploy/podman-compose.dev.yml`

**Changes:**
Replace broken DATABASE_URL with correct syntax:

```yaml
# prod and local
DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/open_mercato

# dev
DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@om-postgres-dev:5432/${POSTGRES_DB:-open-mercato}
```

### Phase 2: Fix init-db.sql Issue

**Option A (Recommended):** Remove the volume mount from prod compose since init-db.sql is empty
```yaml
# Remove this line from prod compose:
- ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

**Option B:** Create a proper init-db.sql file with required extensions:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
```

### Phase 3: Add Superadmin Initialization to Prod Compose

Add to `deploy/podman-compose.prod.yml` app environment:
```yaml
OM_INIT_SUPERADMIN_EMAIL: ${OM_INIT_SUPERADMIN_EMAIL:-superadmin@acme.com}
OM_INIT_SUPERADMIN_PASSWORD: ${OM_INIT_SUPERADMIN_PASSWORD:?OM_INIT_SUPERADMIN_PASSWORD is required}
```

Update `deploy/env/.env.production.template` with:
```bash
# ── Superadmin ─────────────────────────────────────────────────────────────
OM_INIT_SUPERADMIN_EMAIL=superadmin@acme.com
OM_INIT_SUPERADMIN_PASSWORD=<GENERATE_STRONG_PASSWORD>
```

### Phase 4: Security Hardening (Dev Environment)

Remove weak defaults from `deploy/podman-compose.dev.yml`:
```yaml
# Change from:
JWT_SECRET: ${JWT_SECRET:-JWT}
OM_INIT_SUPERADMIN_PASSWORD: ${OM_INIT_SUPERADMIN_PASSWORD:-password}

# To:
JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required in .env}
OM_INIT_SUPERADMIN_PASSWORD: ${OM_INIT_SUPERADMIN_PASSWORD:?OM_INIT_SUPERADMIN_PASSWORD is required in .env}
```

### Phase 5: Update Documentation

Update `deploy/README.md`:
- Add .env setup instructions for superadmin credentials
- Document required variables with generation commands
- Add troubleshooting for DATABASE_URL issues

---

## QA Process Plan for QA Agent

### Pre-Deployment Verification

1. **Environment File Validation**
   - [ ] Verify `.env` file exists in `deploy/` directory
   - [ ] Check all required variables are set (POSTGRES_PASSWORD, JWT_SECRET, SESSION_SECRET, MEILISEARCH_MASTER_KEY)
   - [ ] Verify no weak/default values in production .env
   - [ ] Confirm OM_INIT_SUPERADMIN_PASSWORD is strong and unique

2. **Compose File Syntax Check**
   - [ ] Run `podman-compose -f deploy/podman-compose.prod.yml config` to validate syntax
   - [ ] Verify DATABASE_URL uses correct variable substitution
   - [ ] Check all volume mounts reference existing files/directories

3. **Superadmin Credential Verification**
   - [ ] Confirm OM_INIT_SUPERADMIN_EMAIL is set (default: superadmin@acme.com)
   - [ ] Confirm OM_INIT_SUPERADMIN_PASSWORD is set and strong
   - [ ] Document credentials for QA testing (store securely, not in repo)

### Deployment Testing

4. **Service Startup**
   - [ ] Pull latest image: `podman pull ghcr.io/radicalrad/open-mercato-app:latest`
   - [ ] Start services: `podman-compose -f deploy/podman-compose.prod.yml up -d`
   - [ ] Wait for health checks to pass (check with `podman-compose ps`)
   - [ ] Verify all 4 containers are running: postgres, redis, meilisearch, app

5. **Health Endpoint Verification**
   - [ ] App health: `curl http://localhost:3000/api/health` → 200 OK
   - [ ] PostgreSQL: `podman exec open-mercato-postgres pg_isready` → ready
   - [ ] Redis: `podman exec open-mercato-redis redis-cli ping` → PONG
   - [ ] Meilisearch: `curl http://localhost:7700/health` → 200 OK

6. **Application Functionality**
   - [ ] Access app at http://localhost:3000
   - [ ] Verify login page loads
   - [ ] Test superadmin login with configured credentials
   - [ ] Verify dashboard loads after login

### Superadmin Login Verification

7. **Authentication Flow**
   - [ ] Navigate to login page
   - [ ] Enter superadmin email (superadmin@acme.com)
   - [ ] Enter superadmin password
   - [ ] Verify successful login and redirect to dashboard
   - [ ] Verify user profile shows correct email
   - [ ] Test logout and re-login

8. **Post-Login Verification**
   - [ ] Access admin settings (if applicable)
   - [ ] Verify tenant/organization data loads
   - [ ] Test basic CRUD operations (create/read/update/delete)
   - [ ] Check for any console errors in browser

### Security Verification

9. **Credential Security**
   - [ ] Verify .env is in .gitignore (not committed)
   - [ ] Verify .secrets.env is in .gitignore
   - [ ] Check no passwords in compose file defaults
   - [ ] Verify JWT_SECRET is strong (not "JWT" or similar)

10. **Network Security**
    - [ ] Verify services bind to 127.0.0.1 (not 0.0.0.0)
    - [ ] Confirm PostgreSQL not exposed externally
    - [ ] Confirm Redis not exposed externally
    - [ ] Confirm Meilisearch not exposed externally

### Log Verification

11. **Application Logs**
    - [ ] Check app logs: `podman-compose -f deploy/podman-compose.prod.yml logs app`
    - [ ] Verify no connection errors to PostgreSQL
    - [ ] Verify no connection errors to Redis
    - [ ] Verify no connection errors to Meilisearch
    - [ ] Verify superadmin creation message appears on first run

12. **Error Log Review**
    - [ ] Check for authentication errors
    - [ ] Check for database migration errors
    - [ ] Check for missing environment variable warnings
    - [ ] Verify no stack traces in production logs

### Rollback Testing

13. **Rollback Procedure**
    - [ ] Document current IMAGE_TAG
    - [ ] Test rollback to previous version
    - [ ] Verify services come back up
    - [ ] Verify data integrity after rollback

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `deploy/podman-compose.prod.yml` | Fix DATABASE_URL, remove init-db.sql mount, add superadmin vars | Critical |
| `deploy/podman-compose.local.yml` | Fix DATABASE_URL | Critical |
| `deploy/podman-compose.dev.yml` | Fix DATABASE_URL, remove weak defaults | Critical |
| `deploy/env/.env.production.template` | Add superadmin variables | High |
| `deploy/README.md` | Update setup instructions | Medium |
| `deploy/scripts/init-db.sql` | Either create file or remove directory | Medium |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DATABASE_URL fix breaks existing deployments | Low | High | Test in staging first |
| Weak defaults in dev used in production | Medium | Critical | Remove defaults, require .env |
| Missing superadmin prevents first login | High | High | Add to prod compose |
| init-db.sql mount fails | Medium | Low | Remove empty directory mount |

---

## Success Criteria

1. ✅ All podman-compose files have valid DATABASE_URL syntax
2. ✅ Superadmin can be created on first deployment
3. ✅ All services start and pass health checks
4. ✅ Superadmin can log in successfully
5. ✅ No weak/default credentials in any environment
6. ✅ Documentation updated with correct setup instructions

---

## Rollback Plan

If deployment fails after changes:
1. Revert podman-compose files to previous version
2. Restart services with `podman-compose up -d --force-recreate`
3. Verify services come back up
4. Investigate root cause before re-applying changes

---

## Timeline

- **Phase 1-3:** Critical fixes (DATABASE_URL, init-db, superadmin) - 2 hours
- **Phase 4:** Security hardening - 1 hour
- **Phase 5:** Documentation - 1 hour
- **QA Testing:** 2-3 hours

**Total Estimated Time:** 6-7 hours

---

## Dependencies

- Access to deploy server (SSH)
- Podman/podman-compose installed on server
- GHCR access for image pull
- Superadmin credentials (to be generated)

---

## Notes

- The `:***` in DATABASE_URL appears to be an accidental password masking attempt
- Production deployment requires strong secrets - never use defaults
- QA agent should verify superadmin login as the primary success criterion
- Consider adding a deployment validation script for automated checks

---

*Plan created: 2026-07-24*
*Issue: DARAA-22*
*Status: Ready for Review*
