# Agent Handoff Templates

Standardized handoff formats for agent-to-agent transitions. All agents should use these templates when handing off work.

## Template 1: Architect -> Implementation

```markdown
### Handoff: Architect -> Implementation
- **Issue:** DARAA-XX
- **Spec:** Link to specification document
- **Architecture decisions:** Link to entries in .ai/context/architecture-decisions.md
- **Security items:** Link to entries in .ai/context/security-checklist.md
- **Acceptance criteria:** List from spec
- **Context files to read:** .ai/context/architecture-decisions.md, .ai/context/security-checklist.md
- **Parallel work note:** Security checklist should be reviewed at implementation start
```

## Template 2: Implementation -> Security/QA

```markdown
### Handoff: Implementation -> Security/QA
- **Issue:** DARAA-XX
- **PR:** Link to pull request
- **Files changed:** Key files modified
- **Test results:** Summary of tests run and results
- **Security items addressed:** List from .ai/context/security-checklist.md
- **Context files to read:** .ai/context/implementation-notes.md, .ai/context/security-checklist.md
- **Parallel note:** Security Reviewer and QA Verifier run in parallel
```

## Template 3: Security -> Release

```markdown
### Handoff: Security -> Release
- **Issue:** DARAA-XX
- **Audit result:** PASS / FAIL
- **Risk level:** low / medium / high
- **Checklist items verified:** Count / total
- **Findings:** List any findings (even minor)
- **Recommendation:** Proceed to release / Hold for fixes
- **Context files to read:** .ai/context/security-checklist.md
- **Gate:** Release Engineer must wait for both Security and QA to pass
```

## Template 4: QA -> Release

```markdown
### Handoff: QA -> Release
- **Issue:** DARAA-XX
- **Test result:** PASS / FAIL
- **Scenarios tested:** Count / total from .ai/context/test-scenarios.md
- **Coverage:** What was tested vs gaps
- **Defects found:** Count (0 = clean)
- **Recommendation:** Proceed to release / Hold for fixes
- **Context files to read:** .ai/context/test-scenarios.md
- **Gate:** Release Engineer must wait for both Security and QA to pass
```

## Template 5: Release -> SRE

```markdown
### Handoff: Release -> SRE
- **Issue:** DARAA-XX
- **Staging status:** Deployed / Verified
- **Production status:** Pending approval / Promoted
- **Rollback plan:** Link to rollback procedure
- **Monitoring:** Link to dashboards/alerts
- **SLOs:** Key service level objectives
- **Context files to read:** .ai/context/deployment-status.md, .ai/context/implementation-notes.md
```

## Template 6: Reflection Coach -> Target Agent

```markdown
### Reflection Coach Proposal
- **Target agent:** Agent name
- **Pattern observed:** Description of repeated pattern
- **Evidence:** Links to issues/comments
- **Proposed change:** AGENTS.md diff, skill update, or tool description change
- **Replay cases:** Where this would have helped
- **Gate:** Requires confirmation interaction before application
```

## Usage Rules

1. **Always include context file references** — every handoff should point to relevant .ai/context/ files
2. **Always use timestamped entries** — append to context files, never overwrite
3. **Always tag with issue ID** — every entry must reference the DARAA-XX issue
4. **Parallel work is default** — Security and QA always run in parallel
5. **Sequential gates are explicit** — Release Engineer requires both Security AND QA to pass
