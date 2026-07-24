# Testing Approach Plan for Open Mercato

## Overview

This document defines the comprehensive testing strategy for Open Mercato, including all test types, their execution schedule, maintenance approach, and definition of done for each agent role.

---

## 1. Test Types and Taxonomy

### 1.1 Unit Tests (Jest)

| Aspect | Details |
|--------|---------|
| **Framework** | Jest (via Turbo) |
| **Location** | `packages/<pkg>/src/**/__tests__/*.test.ts(x)` |
| **Naming Convention** | `*.test.ts`, `*.test.tsx` |
| **Scope** | Individual functions, components, utilities, services |
| **Execution** | `yarn test` (all) or per-package via Turbo |
| **CI Gate** | Yes — required for merge |
| **Examples** | `filterValidation.test.ts`, `optimisticLock.test.ts`, `format.test.ts` |

### 1.2 Integration Tests (Playwright)

| Aspect | Details |
|--------|---------|
| **Framework** | Playwright (Chromium) |
| **Location** | `packages/<pkg>/src/modules/<module>/__integration__/*.spec.ts` |
| **Naming Convention** | `TC-<CATEGORY>-<XXX>.spec.ts` |
| **Scope** | End-to-end user flows, API endpoints, cross-module interactions |
| **Execution** | `yarn test:integration` (local) or ephemeral containers |
| **CI Gate** | Yes — required for merge |
| **Sharding** | 15 shards on push (full suite), single runner on PRs (affected modules only) |
| **Examples** | `TC-CRM-034.spec.ts`, `TC-SALES-001.spec.ts`, `TC-LOCK-OSS-001.spec.ts` |

### 1.3 Visual Regression Tests (Playwright Screenshots)

| Aspect | Details |
|--------|---------|
| **Framework** | Playwright screenshot comparison |
| **Location** | `tests/visual/ds-regression.spec.ts` (planned) |
| **Tier 1** | Manual screenshots in PR descriptions (hackathon phase) |
| **Tier 2** | Automated Playwright screenshot tests (weeks 2-4) |
| **Tier 3** | Component showcase page at `/dev/components` (month 2+) |
| **Threshold** | `maxDiffPixelRatio: 0.01` (1%), `threshold: 0.2` per-pixel |
| **Baseline Update** | `npx playwright test --update-snapshots` after visual changes |

### 1.4 Static Analysis & Quality Checks

| Check | Command | When | CI Gate |
|-------|---------|------|---------|
| **TypeScript Type Check** | `yarn typecheck` | Every PR/push | Yes |
| **ESLint** | `yarn lint` | Every PR/push | Yes |
| **Dependency Version Check** | `yarn check:dep-versions` | Every PR/push | Yes |
| **i18n Sync Check** | `yarn i18n:check-sync` | Every PR/push | Yes |
| **i18n Usage Check** | `yarn i18n:check-usage` | Every PR/push | Advisory |
| **i18n Hardcoded Check** | `yarn i18n:check-hardcoded` | On-demand | Advisory |
| **Logger Console Check** | `yarn logger:check-console:ci` | Every PR/push | Yes (blocking) |
| **Time Bomb Check** | `yarn check:time-bombs:fail` | Every PR/push | Yes |
| **Client Boundary Check** | `yarn check:client-boundaries:fail` | On-demand | Yes |
| **Security Audit** | `yarn npm audit --all --recursive --severity high` | On dependency changes | Yes |

### 1.5 Component Tests

| Aspect | Details |
|--------|---------|
| **Framework** | Jest + Testing Library + jest-axe |
| **Location** | `packages/ui/src/primitives/__tests__/*.test.tsx` |
| **Scope** | Render, CSS classes, states, props, a11y, dark mode |
| **Coverage Requirements** | All variants, all states, axe-core scan, keyboard nav |
| **Rule** | Every new DS component MUST have tests before merge |

### 1.6 CRUD Form Persistence Tests

| Aspect | Details |
|--------|---------|
| **Framework** | Playwright integration |
| **Location** | `packages/<pkg>/src/modules/<module>/__integration__/TC-<MOD>-CRUDFORM-*.spec.ts` |
| **Scope** | Field persistence on create/update for all field types |
| **Shared Harness** | `@open-mercato/core/helpers/integration/crudFormPersistence` |
| **Coverage** | Scalars, dictionary references, multiselect/array, custom fields |

### 1.7 Script Tests (Node.js Test Runner)

| Aspect | Details |
|--------|---------|
| **Framework** | Node.js built-in test runner |
| **Location** | `scripts/__tests__/*.test.mjs`, `apps/mercato/scripts/__tests__/*.test.mjs` |
| **Execution** | `yarn test:scripts` |
| **Scope** | Build scripts, utility scripts, dev tooling |

### 1.8 Template Parity Tests

| Aspect | Details |
|--------|---------|
| **Framework** | Jest (create-mercato-app workspace) |
| **Location** | `packages/create-app/` |
| **Execution** | `yarn workspace create-mercato-app test` |
| **Scope** | Ensures monorepo app shell matches standalone template |

---

## 2. When Tests Are Launched

### 2.1 CI Pipeline (GitHub Actions)

```
┌─────────────────────────────────────────────────────────────┐
│                    CI Pipeline (ci.yml)                       │
├─────────────────────────────────────────────────────────────┤
│ Triggers: push to main/develop/feat/wms, PRs to same        │
│ Concurrency: cancel-in-progress per branch                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│  │ prepare  │   │  audit   │   │   lint   │  (parallel)     │
│  │ (build)  │   │ (CVE)    │   │ (ESLint) │                 │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                │
│       │              │              │                        │
│       └──────────────┼──────────────┘                        │
│                      ▼                                       │
│         ┌────────────────────────┐                           │
│         │          test          │  (typecheck + unit tests) │
│         │   (affected on PRs)    │                           │
│         └────────────────────────┘                           │
│                      │                                       │
│  ┌───────────────────┼────────────────────────┐              │
│  │                   ▼                        │              │
│  │  ┌────────────────────────────────────┐    │              │
│  │  │   ephemeral-integration (15 shards)│    │              │
│  │  │   (Playwright + coverage)          │    │              │
│  │  └────────────────────────────────────┘    │              │
│  │                   │                        │              │
│  │                   ▼                        │              │
│  │  ┌────────────────────────────────────┐    │              │
│  │  │        merge-coverage              │    │              │
│  │  │   (combine shard reports)          │    │              │
│  │  └────────────────────────────────────┘    │              │
│  └────────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**PR Flow:**
1. `lint` — ESLint + logger check (fast, fail-early)
2. `audit` — Security audit (only if dependency files changed)
3. `prepare` — Build packages + generate + build app
4. `test` — Typecheck + unit tests (affected packages only on PRs)
5. `ephemeral-integration` — Playwright tests (affected modules only, single runner)
6. Merge requires: all checks green + QA approval (if `needs-qa` label)

**Push to develop/main Flow:**
1. Same parallel jobs, but full suite (15 integration shards)
2. `merge-coverage` combines per-shard coverage reports
3. Coverage summary posted to GitHub Step Summary

### 2.2 Local Development

| Command | When to Use | What It Does |
|---------|-------------|--------------|
| `yarn test` | Quick validation | Run all unit tests |
| `yarn test:integration` | Full integration check | Run all Playwright tests |
| `yarn test:integration:ephemeral` | Isolated testing | Tests in ephemeral Docker containers |
| `yarn test:integration:ephemeral:start` | Manual exploration | Start ephemeral environment |
| `yarn test:scripts` | Script validation | Run Node.js script tests |
| `yarn smart-test` | Smart selection | Run only affected tests |
| `yarn typecheck` | Type safety | TypeScript compilation check |
| `yarn lint` | Code style | ESLint + logger check |

### 2.3 Pre-Merge Validation Gate

The full validation command sequence (from `.ai/agentic.config.json`):

```bash
yarn build:packages
yarn generate
yarn build:packages
yarn i18n:check-sync
yarn i18n:check-usage
yarn typecheck
yarn test
yarn build:app
```

---

## 3. Keeping Tests Up to Date with Features

### 3.1 Module Development Requirements

When creating or modifying a module:

1. **Unit tests** for new services/utilities in `__tests__/` directories
2. **Integration tests** in `__integration__/` for CRUD operations and user flows
3. **Test scenarios** documented in `.ai/qa/scenarios/` using the `TC-<CATEGORY>-<XXX>` naming
4. **Shared fixtures** in `@open-mercato/core/helpers/integration/` for reuse

### 3.2 CRUD Form Persistence Sweep

Automated follow-up ensuring every CrudForm surface saves and reloads:
- All scalar fields
- Dictionary references
- Multiselect/array values
- Custom fields

### 3.3 Visual Regression Updates

When making visual changes:
1. Update baseline screenshots: `npx playwright test --update-snapshots`
2. Commit new baselines with the PR
3. Verify pixel diff threshold is acceptable

### 3.4 Smart Test Selection

The `om-smart-test` skill automatically:
1. Detects changed files via git diff
2. Maps changes to affected test files
3. Runs only relevant Jest and Playwright tests
4. Caches analysis for repeated runs

---

## 4. Definition of Done

### 4.1 Implementation Agent

**Before marking any issue complete:**

| Gate | Command | Status |
|------|---------|--------|
| Type Safety | `yarn typecheck` | PASS |
| Unit Tests | `yarn test` | PASS |
| Linting | `yarn lint` | PASS |
| Build | `yarn build:packages && yarn build:app` | PASS |
| i18n Sync | `yarn i18n:check-sync` | PASS |
| Integration Tests | `yarn test:integration` | PASS |
| Logger Check | `yarn logger:check-console:ci` | PASS |

**Additional requirements:**
- New modules include integration test specs
- CRUD forms have persistence test coverage
- Visual changes include before/after screenshots (hackathon phase)
- No hardcoded colors, strings, or arbitrary Tailwind values
- Optimistic locking enabled on new user-editable entities

### 4.2 Release Agent

**Before merging to develop/main:**

| Gate | Evidence |
|------|----------|
| CI Pipeline Green | All GitHub Actions checks pass |
| QA Approval | `qa-approved` label (if `needs-qa` label present) |
| Security Audit | `yarn npm audit` passes |
| Coverage Threshold | Integration coverage summary meets minimums |
| No Breaking Changes | Backward compatibility contract verified |
| Spec Updated | `.ai/specs/` updated with implementation details |

### 4.3 QA Agent

**Before approving a PR:**

| Check | Evidence |
|-------|----------|
| Integration Tests Pass | Playwright suite green |
| Visual Verification | Screenshots reviewed (if UI changes) |
| Manual Smoke Test | Key user flows verified |
| Edge Cases Covered | Error states, empty states, loading states |
| Accessibility | axe-core scan passes, keyboard navigation works |

### 4.4 Documentation Agent

**Before documenting a feature:**

| Check | Evidence |
|-------|----------|
| API Docs Updated | OpenAPI specs current |
| User Guide Updated | Feature usage documented |
| Migration Notes | Breaking changes documented |
| Examples Working | Code examples execute correctly |

---

## 5. Test Maintenance Strategy

### 5.1 Regular Maintenance Tasks

| Task | Frequency | Owner |
|------|-----------|-------|
| Update Playwright browsers | Monthly | DevOps |
| Review flaky tests | Weekly | QA |
| Update test fixtures | As needed | Implementation |
| Review coverage gaps | Bi-weekly | QA |
| Update baselines | After visual changes | Implementation |

### 5.2 Test Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit Test Coverage | >80% | Jest coverage report |
| Integration Coverage | >70% | Playwright coverage |
| Test Flakiness | <2% | Retry rate monitoring |
| Mean Time to Feedback | <10 min | CI pipeline duration |

### 5.3 Breaking Test Protocol

When a test breaks:
1. **Immediate**: Fix or `test.skip()` with clear reason
2. **Root Cause**: Identify if code or test needs updating
3. **Prevention**: Add regression test if gap discovered
4. **Communication**: Update `.ai/lessons.md` if systemic issue

---

## 6. Tools and Infrastructure

### 6.1 Core Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| Jest | Unit/component tests | Per-package `jest.config.js` |
| Playwright | Integration/e2e tests | `.ai/qa/tests/playwright.config.ts` |
| ESLint | Code style/linting | Root `.eslintrc.js` |
| TypeScript | Type checking | Per-package `tsconfig.json` |

### 6.2 Shared Helpers

| Helper | Import Path | Purpose |
|--------|-------------|---------|
| Auth | `@open-mercato/core/helpers/integration/auth` | Login/role setup |
| API | `@open-mercato/core/helpers/integration/api` | Authenticated requests |
| CRM Fixtures | `@open-mercato/core/helpers/integration/crmFixtures` | Customer data |
| Sales Fixtures | `@open-mercato/core/helpers/integration/salesFixtures` | Order data |
| Queue | `@open-mercato/core/helpers/integration/queue` | Background job drain |

### 6.3 Test Environments

| Environment | Purpose | Setup |
|-------------|---------|-------|
| Local Dev | Development testing | `yarn dev` + manual |
| Ephemeral | Isolated CI testing | `yarn test:integration:ephemeral:start` |
| CI | Automated regression | GitHub Actions |
| Staging | Pre-production validation | Manual deployment |

---

## 7. Appendices

### Appendix A: Test Naming Conventions

```
TC-<CATEGORY>-<XXX>-<optional-descriptive-suffix>.spec.ts

Categories:
  AUTH - Authentication
  CRM  - Customer/CRM
  SALES - Sales
  CAT  - Catalog
  ADMIN - Administration
  LOCK - Optimistic Locking
  CRUDFORM - Form Persistence
```

### Appendix B: CI Matrix Configuration

```yaml
# PR: Single runner, affected modules only
# Push: 15 shards, full suite
shard_matrix: '["1/15","2/15",...,"15/15"]'  # Push
shard_matrix: '["none"]'                       # PR
```

### Appendix C: Coverage Thresholds

```json
{
  "lines": 70,
  "statements": 70,
  "functions": 70,
  "branches": 60
}
```

---

*Document Version: 1.0*
*Created: 2026-07-24*
*Status: Draft - Pending Review*
