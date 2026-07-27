# Cross-References

Purpose: Links between agents, issues, PRs, and context files. Helps any agent find related work when waking up.

## Format

Each entry:
```
### [YYYY-MM-DD] Cross-Reference for Feature X
- **Issue:** DARAA-XX
- **Related issues:** DARAA-YY, DARAA-ZZ
- **PR:** Link to pull request
- **Spec:** Link to specification
- **Architecture decisions:** Link to entry in architecture-decisions.md
- **Security items:** Link to entry in security-checklist.md
- **Test scenarios:** Link to entry in test-scenarios.md
```

## Entries

### [2026-07-24] Security Audit for Dev/Deploy Infrastructure
- **Issue:** DARAA-14
- **Related issues:** DARAA-19 (context files merge), DARAA-22 (fix deployment)
- **Branch:** chore/deploy-and-context-files
- **Security items:** 7 findings in security-checklist.md (F1-F9)
- **Audit result:** CONDITIONAL PASS — 3 must-fix items (F1, F2, F3), 2 should-fix (F5, F9), 2 follow-up (F4, F6)
- **Audited by:** Security Reviewer

### [2026-07-24] DARAA-22 - Fix Deployment
- **Issue:** DARAA-22
- **Related issues:** DARAA-14 (security audit that surfaced some of these), DARAA-19 (context files scaffolding)
- **PR:** TBD (chore/deploy-and-context-files branch, will open after this run)
- **Spec:** `.ai/context/implementation-plan-DARAA-22.md`
- **Architecture decisions:** none (purely compose/config fixes)
- **Security items:** 4 items in security-checklist.md resolved (DATABASE_URL, superadmin init, weak dev defaults, init-db.sql)
- **Test scenarios:** 17 scenarios in test-scenarios.md, 4 verified locally by Implementation Engineer, 13 deferred to QA Verifier on the target host
- **Open follow-ups (not in this PR):** F3 (dev app runs as root user:0), F4 (hardcoded tenant encryption fallback key), F5 (dev ports bound to 0.0.0.0), F6 (Redis no auth) — these are tracked under DARAA-14
- **Note:** during validation, the implementation engineer overwrote the user's pre-existing `deploy/.env` with a test file. The .env is gitignored and contained no committed secrets, but the file contents are unrecoverable. Restored from `.env.production.template`; user must repopulate. Documented in implementation-notes.md and in the Paperclip handoff.

