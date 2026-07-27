# Architecture Decisions Log

Purpose: Persistent cross-agent record of architectural decisions. Append-only, timestamped, issue-tagged entries.

## Format

Each entry:
```
### [YYYY-MM-DD] Short Title
- **Issue:** DARAA-XX
- **Decided by:** Software Architect
- **Context:** Brief context for the decision
- **Decision:** What was decided
- **Impact:** Which modules/components affected
- **Alternatives considered:** Brief notes on other options
```

## Entries

(Entries will be appended as decisions are made)

### [2026-07-24] Dev vs Staging vs Production deployment gates
- **Issue:** DARAA-28
- **Decided by:** Portfolio Owner (with Delivery Manager + Software Architect sign-off on the AGENTS.md / skill updates)
- **Context:** DARAA-22 (Fix deployment) and its QA / Security children (DARAA-23) ran the full production gate even though the change was the kind of fix that ought to ship to dev first. The user surfaced this in DARAA-25 as a process smell: implementers should always be able to ship to dev without the production gate, and the gate should only apply when the change is actually going to a production-equivalent environment. The previous process treated every PR as production-grade, which slowed every change.
- **Decision:** Adopt a three-tier Handoff Tier model. Every implementation issue carries a `Tier: dev | staging | production` field. **Dev deploys: implementer only, no QA / Security / Release child issues, smoke-test by the implementer, mark `done`.** Staging deploys: QA + Security review of the PR before merge to `main`; Release Engineer + SRE handoff. Production deploys: all of the above, plus human protected-environment approval and a `qa-approved` label requirement before merge. Defaults to `production`; the user / Portfolio Owner must explicitly demote. Codified in `.ai/skills/om-dev-vs-prod-gates/SKILL.md`, `.ai/context/handoff-templates.md`, and updated `AGENTS.md` for Implementation Engineer, Release Engineer, Delivery Manager, Independent QA Verifier, and Security Reviewer.
- **Impact:** All five agent AGENTS.md that touch deploys or reviews; new repo-local skill; the Handoff Tier table; the cross-references and lessons files. No code changes in `packages/**`. No infrastructure changes.
- **Alternatives considered:**
  - **Keep one process, add a "skip QA" flag** — rejected: hides the policy in a flag and encourages implementers to skip the gate by default. A typed tier with a default is more auditable.
  - **Two tiers (dev / prod)** — rejected: `staging` is a meaningful intermediate that the existing SRE handoff already supports, and dropping it would force a binary choice that does not match how Paperclip actually deploys.
  - **Use the Paperclip `tier` label natively** — deferred: Paperclip's data model does not currently enforce tier behaviour, so we use a description-level `Tier:` field plus a `paperclip-operations/handoff-fork` change. A future Paperclip enhancement could lift this to a first-class label.

### [2026-07-27] Lesson: secret-masker redacts `${...}` substitution in `str` (not bytes) — verify credential-bearing config at the byte level
- **Issue:** DARAA-26 (architect review of PR #8 / DARAA-22)
- **Decided by:** Software Architect
- **Context:** The architect's first pass on PR #8 was REQUEST CHANGES based on reading the rendered `DATABASE_URL` line in `deploy/podman-compose.{prod,local,dev}.yml` and seeing `${POSTGRES_USER:***@postgres:5432/open_mercato`. The rendered display suggested the closing `}` of the variable substitution was missing and the `***@...` tail was the default value, leaving `POSTGRES_PASSWORD` un-substituted. A second architect pass on the same PR re-ran the verification with raw-bytes output (subprocess → `od`/`xxd`/`read('rb')` → hex dump) and confirmed the on-disk file is the fix: `postgresql://${POSTGRES_USER:-open_mercato}:${POSTGRES_PASSWORD}@postgres:5432/open_mercato`. The `***` is a `str`-level redaction applied by the terminal/IDE display layer (and by `podman-compose config` TTY redaction), not the actual file content. A third pass (re-running `podman-compose config` with a unique-marker env file and inspecting the raw bytes of the output) confirmed the password IS substituted at runtime — the rendered `***` is just the display. The first pass was a false-positive review that opened a wasteful re-fix issue (DARAA-34) and a `blocked` disposition; both were retracted after the byte-level verification.
- **Decision:** Architect / implementation / security reviews on credential-bearing config **MUST** verify with raw bytes, not rendered display. The check is "does the raw byte sequence contain the expected variable substitution", not "does the rendered string look right". For compose files: read each line as `bytes` via Python `read('rb')` and decode in 32-byte chunks; compare the hex to the expected `${VAR}` byte sequence (e.g. `24 7b 50 4f 53 54 47 52 45 53 5f 55 53 45 52 7d 3a 24 7b 50 4f 53 54 47 52 45 53 5f 50 41 53 53 57 4f 52 44 7d`). For podman-compose config output: capture the output to a file via `subprocess.run(..., capture_output=True)`, then read the file with `open(..., 'rb')` and inspect the bytes around `DATABASE_URL:`. Any time a verification claims `***` in a credential context, the right question is "is the raw byte sequence correct", not "is the rendered string correct". The terminal/IDE display applies a redaction at the `str` level that LOOKS like a literal bug but is not.
- **Impact:** `.ai/lessons.md` lesson "Secret-masker displays `***` for credential patterns" added; future architect / implementation / security runs MUST verify credential-bearing config with raw bytes, not rendered display. Process change: any review of `deploy/`, `.env*`, `*.env*`, or any other credential-bearing file should include a `od -c` / `xxd` / Python `read('rb')` step in the verification, not just `cat`/`grep`/`awk`/`sed`. The architect's PR-review checklist should grow this rule (could go in `.ai/skills/om-code-review/SKILL.md` Step 1 if that skill is repo-local). No code changes in `packages/**`. No infrastructure changes.
- **Alternatives considered:**
  - **Trust the rendered display and gate on the false-positive** — the original wrong path; led to a wasted re-fix iteration. Rejected.
  - **Add a CI hook to fail the build when a compose file contains `***`** — rejected: false positive on every legitimate secret-masker render in CI logs and PR diffs; the mask is a display-only artifact, not in the file. The right check is the raw-bytes verification, not a CI hook on a substring.
  - **Document the secret-masker behavior in a single agent AGENTS.md** — considered; deferred. The lesson is cross-agent (architect, implementation, security, QA, release) and is better captured in `.ai/lessons.md` so all agents pick it up. A more permanent fix would be a `.agents/skills/om-secret-masker-aware-review` skill, but that is out of scope for this review.

### [2026-07-27] Implementer re-verification of the architect's byte-level retraction (independent confirmation)
- **Issue:** DARAA-34 (re-fix), DARAA-22 (in_review), DARAA-26 (architect review — retracted)
- **Decided by:** Implementation Engineer
- **Context:** The architect's second-pass entry above records the retraction of DARAA-26's REQUEST_CHANGES and the re-affirmation that the `46579a7` DATABASE_URL fix is byte-correct. DARAA-34 was opened on the first-pass premise (display-mask false positive) and routed to the implementation engineer for a re-fix. Before pushing any commit, the implementer independently re-verified the byte-level state and reached the same conclusion as the architect's second pass. The full evidence is at `.ai/runs/daraa-34/evidence.txt`. Two independent agents (architect, implementer) using two independent byte-level verification methods (the architect's `od`/`xxd`/`read('rb')`; the implementer's `od -c` + Python `bytes.count`) reached the same conclusion on the same files. The probability of two independent false positives producing the same byte-correct substitution is effectively zero.
- **Decision:** The implementer's heartbeat on DARAA-34 closes without a re-fix commit. The compose files are unchanged from `46579a7`. The context files (`.ai/context/security-checklist.md`, `.ai/context/test-scenarios.md`, `.ai/context/implementation-notes.md`) are updated to record the display-mask finding and to re-affirm the original fix as byte-accurate. `deploy/README.md:199-205` gains a small "Note on display redaction" block that documents the redaction and gives operators a byte-level verification recipe. No Paperclip children are created; no new PR is opened; the existing PR #8 head `46579a7` stands as the correct deliverable for DARAA-22 and is now ready for the architect's re-review for merge.
- **Impact:** All five agent AGENTS.md that touch deploys or reviews gain the cross-cutting "verify credential-bearing config at the byte level" rule via the architect's earlier entry. The DARAA-22 / DARAA-26 review cycle is now unblocked for merge on the actual deliverable, not on a display-mask false positive. No code changes in `packages/**`. No infrastructure changes.
- **Alternatives considered:**
  - **Push a no-op re-fix commit to close DARAA-34 in a way the issue body recognized** — rejected: the issue body is itself the false-positive artifact, as documented in the architect's second-pass entry above. Pushing a no-op commit to satisfy a now-retracted REQUEST_CHANGES would re-introduce the same anti-pattern DARAA-26 caught in the original `46579a7` (commit message claims work that the diff did not do). The right action is to update the context files and post a handoff comment so the issue can be closed with the actual reason ("byte-level evidence confirms fix is in place"), not with a fake "re-fix" reason.
  - **Escalate to Portfolio Owner for arbitration** — not needed: two independent agents have independently verified the same byte-level state, and the architect's second-pass decision is the authoritative direction. The implementer is following the architect's revised decision.
