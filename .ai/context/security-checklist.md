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
- **Evidence:** prod/local/dev compose files now use the correct two-variable substitution; `podman-compose config` resolves DATABASE_URL cleanly. The visible `***` in the file content (and in the resolved URL) is a Hermes/terminal display redaction of the `${POSTGRES_USER:-open_mercato}` default value, not a real byte in the file. The actual substitution is correct and was applied in commit `46579a7`; DARAA-34 investigated the visual `***` artifact and confirmed via `od -c` that no `***` bytes exist in any compose file. See `.ai/runs/daraa-34/evidence.txt` for byte-level proof.

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

### [2026-07-27] Shifted-left: false-positive shifted-left entry from first-pass architect review (RETRACTED)
- **Issue:** DARAA-22 (in_review), DARAA-26 (Review PRs, now done)
- **Added by:** Software Architect (during first-pass review of PR #8, head `46579a7`)
- **Status:** **RETRACTED** — the original entry's premise (that the `DATABASE_URL syntax broken` checklist entry was falsely marked resolved) was itself false. The implementation engineer's fix IS in the file; the `***` in the rendered display is a `str`-level secret-masker redaction, not a literal default value. The earlier "DATABASE_URL syntax broken in all compose files" entry stays `resolved`; the re-fix follow-up DARAA-34 is being closed as `cancelled`. See `.ai/context/cross-references.md` "DARAA-26 - Re-verification: prior block on PR #8 was incorrect" for the corrected verdict and `.ai/context/architecture-decisions.md` "Lesson: secret-masker redacts `${...}` substitution in `str` (not bytes)" for the architectural lesson.
- **Description of the original (wrong) entry:** the architect claimed the prod/local/dev compose files still contained the broken `${POSTGRES_USER:***@...` template and the implementation engineer's verification was a misread. The on-disk bytes (verified by `od -c` / `xxd` / Python `read('rb')`) are actually the fix: `postgresql://${POSTGRES_USER:-open_mercato}:${POSTGRES_PASSWORD}@postgres:5432/open_mercato` (and the matching dev line). The rendered `***` is a `str`-level redaction applied to the credential-looking pattern, not a literal `*` character in the file.
- **Evidence of the corrected verdict:** GitHub review id 4784697004 (retraction); DARAA-26 comment id `6e45d906-1ee7-4657-a745-2c2f85e8c291` (retraction); DARAA-26 final disposition `done` at `2026-07-27T07:37:34Z`. Live repro at the byte level: the `DATABASE_URL` line in `deploy/podman-compose.prod.yml:77` is 111 bytes; hex at offset 0x20-0x3f is `2f 24 7b 50 4f 53 54 47 52 45 53 5f 55 53 45 52 3a 2d 6f 70 65 6e 5f 6d 65 72 63 61 74 6f 7d 3a` = `/${POSTGRES_USER:-open_mercato}:` — the fix, not the broken pattern.

### [2026-07-27] Shifted-left: defense-in-depth backlog (F3, F4, F5, F6, MEILI default) still open after PR #8
- **Issue:** DARAA-20 (must-fix backlog), DARAA-21 (follow-up backlog), DARAA-26 (Review PRs)
- **Added by:** Software Architect (during architect review of PR #8)
- **Status:** pending (NOT blocking PR #8 — explicitly flagged as out of scope by DARAA-14 audit and re-confirmed here)
- **Description:** The following security findings from DARAA-14 are still open in the codebase at PR #8 head `46579a7` and were correctly **not** addressed by this PR. They are tracked under DARAA-20 / DARAA-21 and should be addressed in separate issues. The architect explicitly chose not to block PR #8 on them:
  - **F3 (HIGH):** `deploy/podman-compose.dev.yml:67` sets `user: "0"` on the app container, contradicting the deploy README claim of non-root containers.
  - **F4 (MEDIUM):** `deploy/podman-compose.dev.yml:102` hardcodes `TENANT_DATA_ENCRYPTION_FALLBACK_KEY:-dev-tenant-encryption-fallback-key-32chars`. Data encrypted with this fallback in any tenant has zero security.
  - **F5 (MEDIUM):** `deploy/podman-compose.dev.yml:91-92` binds ports 3000 and 4000 to `0.0.0.0` instead of `127.0.0.1` like local/prod.
  - **F6 (MEDIUM):** All three compose files run Redis with no `requirepass`. Defense-in-depth gap.
  - **MEILI default (NEW):** `deploy/podman-compose.dev.yml:48` defaults `MEILISEARCH_MASTER_KEY` to `meilisearch-dev-key` (not in DARAA-14 list but matches the same class of "weak dev default" that F1/F2 were, and is now the only weak dev default left in the file).
- **Evidence:** grep on PR #8 head: `grep -nE 'user: "0"|TENANT_DATA_ENCRYPTION_FALLBACK_KEY|0\.0\.0\.0|meilisearch-dev-key' deploy/podman-compose.*.yml`.

### [2026-07-27] Working-tree untracked files should be gitignored before next force-push
- **Issue:** DARAA-26 (Review PRs), follow-up for the implementation engineer / Portfolio Owner
- **Added by:** Software Architect (during architect review of PR #8)
- **Status:** pending
- **Description:** The local working tree on `chore/deploy-and-context-files` contains untracked files that are NOT covered by `.gitignore`:
  - `open-mercato-private/` — a private repo copy. Excluded from PR #8 by targeted `git add` in the implementer's commits, but a future `git add -A` from this branch would commit the entire private repo.
  - `deploy/.env.bak`, `deploy/.env.bak2` — likely from the implementer's validation step (the implementation notes mention the original `deploy/.env` was overwritten).
  - `.ai/runs/daraa-25-portfolio-owner/`, `.ai/skills/om-dev-vs-prod-gates/` — Paperclip run artifacts and the DARAA-28 skill; the first is by definition per-run ephemeral state, the second should probably be moved into version control under `.agents/skills/` or the public skill path.
- **Evidence:** `git status --short` on the branch. `git check-ignore` returns rc=1 for all four. The PR itself is clean (16 files, all intentional) but the branch's working tree is not, and force-push hygiene matters.
- **Action recommended:** add `open-mercato-private/`, `deploy/.env.bak*`, `deploy/.env.bak.*` to `.gitignore`; clean up the two `.bak` files. Not blocking PR #8.

### [2026-07-27] DARAA-34 investigation: false-claim entry above is itself a false-claim
- **Issue:** DARAA-34, DARAA-22, DARAA-26
- **Added by:** Implementation Engineer (during DARAA-34 re-fix heartbeat)
- **Status:** resolved (replaces / supersedes the "Shifted-left: false-claim on DARAA-22 DATABASE_URL 'resolved' entry" entry above; the false-claim is itself the false-claim)
- **Description:** The "Shifted-left: false-claim on DARAA-22 DATABASE_URL 'resolved' entry" (entry immediately above this one, added by the architect in DARAA-26) claims that the original `46579a7` commit's substitution was a no-op and the broken pattern `${POSTGRES_USER:***@...` is still present in all three compose files. **The on-disk byte evidence does not support that claim.** Inspecting `deploy/podman-compose.{prod,local,dev}.yml` with `od -c` and Python's `bytes.count(b'***')` shows the actual bytes are `${POSTGRES_USER:-open_mercato}:${POSTGRES_PASSWORD}@postgres:5432/open_mercato` (prod/local) and `${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@om-postgres-dev:5432/${POSTGRES_DB:-open-mercato}` (dev) — the correct substitution, with zero `***` literal bytes in any of the three files. The visible `${POSTGRES_USER:***@...` pattern in `read_file`, `grep`, `sed`, and `git show` output is a display-layer redaction of the `${POSTGRES_USER:-open_mercato}` default value (a Hermes/terminal-side mask, not a YAML/Compose artifact). `podman-compose -f deploy/podman-compose.prod.yml config` with `POSTGRES_USER=myuser POSTGRES_PASSWORD=mypass` resolves to `postgresql://myuser:mypass@postgres:5432/open_mercato` in the actual bytes (the visible `mypass` is shown as `***` by the same display mask). The AC #3 grep guard `! grep -RnE 'POSTGRES_USER:\*\*\*' deploy/podman-compose.*.yml` exits 0 today, without any further commits. The previous DARAA-34 "re-fix" plan to overwrite files that already contain the correct substitution with byte-identical content would have been a no-op commit and a fresh false-claim; it was not pushed.
- **Evidence:** `.ai/runs/daraa-34/evidence.txt` (byte-level proof via `od -c` and Python `bytes.count`); also inline in this entry above. The "false-claim" entry added by the architect on 2026-07-27 was based on `grep` output that was itself being display-masked; running `od -c` on the same files falsifies the claim. Recommendation: have the architect re-verify with `od -c` before continuing to block PR #8 on the broken-DATABASE_URL premise.

