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
  - [x] Error case: Old-style `${POSTGRES_USER:***@...` no longer present in any file (verify via grep `! grep -RnE 'POSTGRES_USER:\*\*\*' deploy/podman-compose.*.yml` — exits 0 today on `46579a7`; see `.ai/runs/daraa-34/evidence.txt` for byte-level proof via `od -c` and `python -c 'open(...).read().count("***") == 0'`). **Note (added 2026-07-27, DARAA-34):** the visible `***` token in `read_file`/`grep`/`sed` output is a Hermes/terminal display redaction of the `${POSTGRES_USER:-open_mercato}` default value, not a real byte; do not be fooled by it when re-running this scenario.
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

### [2026-07-27] DARAA-34 byte-level re-verification of DARAA-22 scenarios
- **Issue:** DARAA-34 (re-fix), DARAA-22 (original)
- **Added by:** Implementation Engineer
- **Scenarios re-run on commit `46579a7` (the head of the branch the architect gated on):**
  - [x] Byte-level: All three compose files contain `${POSTGRES_USER}:${POSTGRES_PASSWORD}` (with `:-<default>` on the user side, no default on password side). Confirmed by `od -c` and Python `bytes.count(b'***') == 0` for all three files. See `.ai/runs/daraa-34/evidence.txt`.
  - [x] Byte-level: `podman-compose -f deploy/podman-compose.prod.yml config` (with `POSTGRES_USER=myuser POSTGRES_PASSWORD=mypass`) resolves the app's `DATABASE_URL` to `postgresql://myuser:mypass@postgres:5432/open_mercato` in actual bytes. Same for `local` and `dev`.
  - [x] AC #3 grep guard: `! grep -RnE 'POSTGRES_USER:\*\*\*' deploy/podman-compose.*.yml` exits 0 today.
  - [x] README troubleshooting block (`deploy/README.md:199-205`): the code-block example on L202 contains the correct substitution `${POSTGRES_USER:-open_mercato}:${POSTGRES_PASSWORD}@...` in actual bytes; the heading and closing prose intentionally describe the `***` symptom an operator may see if they have an older compose file. (The `***` in the visible L202 code block is the same Hermes/terminal display redaction as the compose files — byte-level `od -c` shows the correct substitution.)
- **Results:** pass — the previous "Error case: Old-style `${POSTGRES_USER:***@...` no longer present" claim in DARAA-22 is byte-accurate; no further compose-file changes are needed. DARAA-34 closes as a no-op re-fix with the display-mask root cause documented for future agents.

