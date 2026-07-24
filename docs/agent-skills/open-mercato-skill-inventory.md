# Open Mercato Skill Inventory

## Overview

This document catalogs all Open Mercato agent skills discovered from the [open-mercato-private](https://github.com/radicalrad/open-mercato-private) repository and installed into the Paperclip instance.

**Source Repository**: https://github.com/radicalrad/open-mercato-private  
**Discovery Date**: 2026-07-24  
**Total Skills Discovered**: 46 (29 unique, 17 duplicates in template)  
**Skills Installed**: 29  
**Skills Attached to Agent**: 29

## Skill Categories

### Core Development Workflow
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-help | .ai/skills/om-help | Workflow navigator for orientation and technical how-to | All development | Yes | Essential for agent orientation | None |
| om-spec-writing | .ai/skills/om-spec-writing | Guide for creating high-quality specifications | Specs, .ai/specs/ | Yes | Core spec workflow | None |
| om-implement-spec | .ai/skills/om-implement-spec | Implement specifications using coordinated subagents | Specs, code | Yes | Core implementation workflow | None |
| om-pre-implement-spec | .ai/skills/om-pre-implement-spec | Analyze spec before implementation | Specs | Yes | Prevents implementation issues | None |
| om-create-agents-md | .ai/skills/om-create-agents-md | Create/rewrite AGENTS.md files | All packages/modules | Yes | Essential for agent guidance | None |

### Code Quality & Review
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-code-review | .ai/skills/om-code-review | Code review with Docker-vs-local gate detection | PRs, code | Yes | Core review workflow | None |
| om-auto-review-pr | .ai/skills/om-auto-review-pr | Auto review PR with GitHub checks first | PRs | Yes | Automation for reviews | None |
| om-smart-test | .ai/skills/om-smart-test | Run only affected tests | Test suites | Yes | Efficient testing | None |
| om-integration-tests | .ai/skills/om-integration-tests | Run/create QA integration tests | Test suites | Yes | E2E testing workflow | None |
| om-prepare-test-env | .ai/skills/om-prepare-test-env | Prepare test environment | Test suites | Yes | Environment setup | None |

### UI & Design
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-backend-ui-design | .ai/skills/om-backend-ui-design | Design backend interfaces using @open-mercato/ui | UI, pages | Yes | Core UI workflow | None |
| om-ds-guardian | .ai/skills/om-ds-guardian | Design System Guardian for compliance | UI, pages | Yes | Design system enforcement | None |

### AI & Automation
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-create-ai-agent | .ai/skills/om-create-ai-agent | Build/extend AI agents | AI modules | Yes | AI agent development | None |
| om-auto-sec-report | .ai/skills/om-auto-sec-report | Security report driver | Security analysis | Yes | Security automation | None |
| om-auto-sec-report-pr | .ai/skills/om-auto-sec-report-pr | Security analysis for single unit | Security analysis | Yes | Security automation | None |
| om-auto-qa-scenarios | .ai/skills/om-auto-qa-scenarios | Generate QA reports | QA workflows | Yes | QA automation | None |
| om-auto-publish-pr | .ai/skills/om-auto-publish-pr | Publish PR package previews | PRs | Yes | Package preview automation | None |

### Integration & Extensions
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-integration-builder | .ai/skills/om-integration-builder | Build integration providers | Integrations | Yes | Integration development | None |
| om-app-spec-writing | .ai/skills/om-app-spec-writing | Write App Specs | Specs | Yes | Business-level specs | None |
| om-gap-analysis | .ai/skills/om-gap-analysis | Platform gap analysis | Engagement docs | Yes | Coverage analysis | None |

### PR Automation
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-auto-create-pr-loop | .ai/skills/om-auto-create-pr-loop | Auto create PR loop | PRs | Yes | PR automation | None |
| om-auto-continue-pr-loop | .ai/skills/om-auto-continue-pr-loop | Auto continue PR loop | PRs | Yes | PR automation | None |
| om-followup-issue-from-pr | .ai/skills/om-followup-issue-from-pr | Follow-up issues from PRs | PRs, issues | Yes | Issue automation | None |
| om-prepare-issue | .ai/skills/om-prepare-issue | Prepare issues | Issues | Yes | Issue preparation | None |

### Migration & Maintenance
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-migrate-mikro-orm | .ai/skills/om-migrate-mikro-orm | MikroORM v6 to v7 migration | ORM code | Yes | Migration guidance | None |
| om-dev-container-maintenance | .ai/skills/om-dev-container-maintenance | Maintain Dev Container setup | .devcontainer/ | Yes | Container maintenance | None |
| om-auto-upgrade-0.4.10-to-0.5.0 | .ai/skills/om-auto-upgrade-0.4.10-to-0.5.0 | Upgrade to 0.5.0 | Codebase | Yes | Version upgrade | None |
| om-fix-specs | .ai/skills/om-fix-specs | Normalize spec filenames | Specs | Yes | Spec hygiene | None |

### Skills Creation
| Skill | Source | Purpose | Applies to | Attach? | Reason | Risks / constraints |
|-------|--------|---------|------------|---------|--------|---------------------|
| om-skill-creator | .ai/skills/om-skill-creator | Guide for creating skills | Skills | Yes | Skill development | None |

## Duplicate Skills (Template)

The following skills exist in both `.ai/skills/` and `packages/create-app/agentic/shared/ai/skills/`:

- om-auto-continue-pr-loop
- om-auto-create-pr-loop
- om-auto-review-pr
- om-auto-upgrade-0.4.10-to-0.5.0
- om-backend-ui-design
- om-help
- om-implement-spec
- om-integration-builder
- om-prepare-test-env

**Resolution**: Only the `.ai/skills/` versions were installed as they are the canonical source for the main repository.

## Skills Not Installed

The following skills were discovered but not installed:

| Skill | Reason |
|-------|--------|
| backend-ui-design (codex version) | Duplicate of om-backend-ui-design |
| om-auto-fix-issue | Template-only, not applicable to main repo |
| om-data-model-design | Template-only, not applicable to main repo |
| om-eject-and-customize | Template-only, not applicable to main repo |
| om-module-scaffold | Template-only, not applicable to main repo |
| om-system-extension | Template-only, not applicable to main repo |
| om-trim-unused-modules | Template-only, not applicable to main repo |
| om-troubleshooter | Template-only, not applicable to main repo |

## Agent Attachment

The following 29 skills are attached to the Delivery Manager agent:

```
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-help
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-spec-writing
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-implement-spec
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-code-review
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-review-pr
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-create-agents-md
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-ds-guardian
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-backend-ui-design
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-integration-tests
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-smart-test
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-pre-implement-spec
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-prepare-test-env
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-skill-creator
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-create-ai-agent
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-integration-builder
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-app-spec-writing
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-fix-specs
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-gap-analysis
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-migrate-mikro-orm
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-prepare-issue
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-followup-issue-from-pr
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-sec-report
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-sec-report-pr
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-qa-scenarios
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-publish-pr
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-create-pr-loop
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-continue-pr-loop
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-dev-container-maintenance
company/bcc62707-4781-4913-817d-6f5307ebfa04/om-auto-upgrade-0.4.10-to-0.5.0
```

## Validation

- All skills were created successfully via the Paperclip API
- Agent's desiredSkills list was updated to include all 29 Open Mercato skills
- Total desired skills for Delivery Manager agent: 48 (19 existing + 29 Open Mercato)
- All skill files are valid SKILL.md format with YAML frontmatter
- All skill names follow the `om-*` naming convention

## Notes

- Skills are stored in the Paperclip company skills directory
- Skills are attached to the agent via the `paperclipSkillSync.desiredSkills` configuration
- The agent will automatically sync these skills on next heartbeat
- Skills can be updated by patching the skill content via the API
