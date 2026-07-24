# Test Scenarios

Purpose: Shared test scenario registry for QA Verifier and Implementation Engineer. Tracks what needs testing and what was tested.

## Format

Each entry:
```
### [YYYY-MM-DD] Test Scenarios for Feature X
- **Issue:** DARAA-XX
- **Added by:** Implementation Engineer / QA Verifier
- **Scenarios:**
  - [ ] Happy path: description
  - [ ] Edge case: description
  - [ ] Error case: description
  - [ ] Security: description
- **Results:** pending | pass | fail (with evidence link)
```

## Entries

### [2026-07-24] Test Scenarios for DARAA-22 - Fix Deployment
- **Issue:** DARAA-22
- **Added by:** Implementation Engineer
- **Scenarios:**
  - [x] Happy path: All three podman-compose files parse cleanly under `podman-compose config` (verified locally)
  - [x] Happy path: Resolved DATABASE_URL uses `${POSTGRES_USER}:${POSTGRES_PASSWORD}` correctly in all three files (verified locally)
  - [ ] Happy path: Live deploy with valid .env, verify all services start (QA: target host)
  - [ ] Happy path: Superadmin auto-creates on first run from OM_INIT_SUPERADMIN_* (QA: target host)
  - [ ] Happy path: Superadmin can log in with configured credentials (QA: target host, http://localhost:3000)
  - [ ] Edge case: Missing OM_INIT_SUPERADMIN_PASSWORD in .env — compose should fail with "variable is required" at `up` (QA: target host, smoke test by unsetting var)
  - [ ] Edge case: Missing JWT_SECRET in dev .env — compose should fail with "variable is required" (QA: local dev)
  - [ ] Error case: Old-style `${POSTGRES_USER:***@...` no longer present in any file (verify via grep — already verified)
  - [ ] Error case: init-db.sql mount removed; prod compose boots without it (QA: target host)
  - [ ] Security: No default credentials in any compose file (verified: only defaults are for the postgres container in dev, not for the app's auth)
  - [ ] Security: Services bind to 127.0.0.1 only in prod/local (verified in file)
  - [ ] Security: .env not committed to git (already gitignored)
  - [ ] Security: JWT_SECRET is strong and unique (operator must set via openssl rand per README)
  - [ ] Security: Superadmin password is strong and unique (operator must set via openssl rand per README)
  - [ ] Security: PostgreSQL not exposed externally (verified: 127.0.0.1:5432 in prod/local)
  - [ ] Security: Redis not exposed externally (verified: 127.0.0.1:6379 in prod/local)
  - [ ] Security: Meilisearch not exposed externally (verified: 127.0.0.1:7700 in prod/local)
- **Results:** pending (Implementation: syntax/config checks passed; live deploy + superadmin login to be verified by QA Verifier on the target host)

