# AUT-31 / R2 — Local Chrome/browser Debug Tool for Agents (Playwright + CDP browser MCP server)

**Status:** DRAFT — pending standard design/arch review (UI-adjacent, not waivable)
**Owner:** Backend Engineer (agent 2c9e6847)
**Parent:** AUT-28 (recommendation R2)
**Issue:** AUT-31 — Agent improvement R2

## 1. Goal

Give Open Mercato agents (and coding CLIs via the R1 MCP path) a **local browser
debug tool** that can drive the running app in a real Chrome/Edge over CDP and
return debug artifacts (screenshots, DOM/console reads). This closes the biggest
gap identified in AUT-28: agents today have no way to "see" the app they are
mutating.

Constraint (from AUT-28 / parent): the capability is added as an **`@app` overlay
extension / new AI tool / browser MCP server**, **NOT** a `src/modules` core patch.

## 2. In/Out of Scope

**In scope**
1. A `browser_debug` agent tool that launches local Chrome/Edge with
   `--remote-debugging-port` (CDP), targeting the app URL (default
   `http://localhost:3000`), using the Playwright already vendored in
   `node_modules` (`@playwright/test` 1.61.1 + `playwright-core` 1.61.1).
2. Verbs: `open`/`navigate`, `screenshot` (debug artifact), `read_dom`,
   `read_console`, `click`, `back`.
3. Strict local-only guard: refuse any non-loopback target; require an explicit
   `OM_ENABLE_AGENT_BROWSER_DEBUG=1` env flag — **fail closed** in prod.
4. Expose as a **`browser` MCP server** so the R1 MCP path and the coding CLIs
   consume it; also register the in-app tool alias so the playground/agent chat
   toolset picks it up.
5. Verification: agent-driven navigation against an ephemeral app + screenshot
   lands on a record; negative test that the disabled flag blocks the tool.

**Out of scope**
- Remote/live-site debugging, cross-tenant navigation, any non-loopback target.
- Modifying `packages/core/src/modules/*` (this is an `@app` overlay).
- Production availability of the tool (fail closed: absent unless the env flag
  is explicitly set — which it must not be in prod).

## 3. Architecture

### 3.1 Placement — `@app` overlay module `browser_debug`

New app-local module under:

```
apps/mercato/src/modules/browser_debug/
├── acl.ts                 # FeatureDefinition: browser_debug.debug
├── setup.ts               # grant browser_debug.debug to admin/superadmin only
├── ai-tools.ts            # defineAiTool registration (in-app tool alias)
├── lib/
│   ├── browser-debug.ts   # CDP launcher + verb implementation (Playwright)
│   ├── loopback-guard.ts  # URL policy: loopback only, fail-closed
│   └── __tests__/
├── cli.ts                 # ModuleCli: `browser_debug mcp:serve-browser`
├── index.ts               # ModuleInfo metadata
└── README.md
```

Registered in `apps/mercato/src/modules.ts`:

```ts
{ id: 'browser_debug', from: '@app' }
```

The generator (`yarn generate`) auto-discovers `ai-tools.ts` and
`cli.ts` under an enabled `@app` module (same mechanism the `example` and
`ratelimit_probe` modules use), so no core patch is required.

### 3.2 Two consumption surfaces

| Surface | Mechanism | Consumer |
|---------|-----------|----------|
| In-app AI tool | `defineAiTool` in `ai-tools.ts` (registered via generated `ai-tools.generated.ts` → `registerMcpTool`) | Agent chat + playground toolset + `mcp:list-tools` |
| Browser MCP server | `ModuleCli` `browser_debug mcp:serve-browser` (stdio MCP server) | R1 MCP client / coding CLIs (`mcp-server-config`, `.mcp.json`) |

Both share the same `lib/browser-debug.ts` driver and the same `loopback-guard`
policy. The MCP server is the "new server so R1 composes"; the in-app tool is the
"alias for the playground" — as the parent recommendation requires.

### 3.3 CDP browser driver

- Use Playwright's `chromium` (resolves to the local Chrome for Testing already
  installed in `~/Library/Caches/ms-playwright`, or the system `/Applications/Google
  Chrome.app` / `Microsoft Edge.app` when present) launched with
  `args: ['--remote-debugging-port=<port>']`.
- Default target: `http://localhost:3000` (overridable via
  `OM_AGENT_BROWSER_URL`).
- Verbs map to Playwright page APIs:
  - `open`/`navigate` → `page.goto(url)` (after loopback guard)
  - `screenshot` → `page.screenshot()` → persist as debug artifact (return path)
  - `read_dom` → `page.content()` truncated / `page.locator('body').innerText()`
  - `read_console` → CDP `Runtime.consoleAPICalled` collected since navigation
  - `click` → `page.locator(selector).click()` (CSS selector)
  - `back` → `page.goBack()`

### 3.4 Fail-closed security model

1. **Env gate:** every verb checks `OM_ENABLE_AGENT_BROWSER_DEBUG === '1'`.
   Unset/`0`/anything else ⇒ tools not registered (in-app) or the MCP server
   refuses to start / returns a hard error. Never silently enabled.
2. **Loopback guard:** any user-supplied target URL must resolve to a loopback
   address. `http://localhost:*`, `http://127.0.0.1:*`, `http://[::1]:*` pass;
   anything else (incl. hostnames that DNS-resolve off-loopback) is rejected.
   The guard also rejects `file:` and non-http(s) schemes.
3. **Prod posture:** `OM_ENABLE_AGENT_BROWSER_DEBUG` is a **new configuration
   variable declared in this design's Configuration section**; production must
   keep it unset so the whole capability fails closed.

## 4. Contract (zod schemas)

Tool namespace `browser_debug.*`:

```ts
browser_debug.open       { url: string /* loopback only */ }
browser_debug.navigate   { url: string }
browser_debug.screenshot { path?: string }            -> { artifactPath, pageUrl }
browser_debug.read_dom   {}                            -> { html: string (truncated) }
browser_debug.read_console {}                          -> { entries: {level,text}[] }
browser_debug.click      { selector: string }          -> { ok: true }
browser_debug.back       {}                            -> { url: string }
```

Each: `requiredFeatures: ['browser_debug.debug']`, `isMutation: false` (debug
artifacts only; no tenant data writes). Zeros tenant data access — purely local
browser introspection of the developer's own running app.

## 5. ACL & setup

- `acl.ts`: `{ id: 'browser_debug.debug', title: 'Browser debug', module: 'browser_debug' }`
- `setup.ts` `defaultRoleFeatures`: grant `browser_debug.*` to `superadmin` and
  `admin` only (never `employee`). Enforcement is belt-and-braces: even admins
  still hit the env fail-closed gate.

## 6. Configuration (new env variables)

Declared in `.ai/specs/2026-08-20-aut31-browser-debug-design.md` Configuration section:

| Variable | Default | Meaning |
|----------|---------|---------|
| `OM_ENABLE_AGENT_BROWSER_DEBUG` | unset | MUST be exactly `1` to enable; fail closed otherwise |
| `OM_AGENT_BROWSER_URL` | `http://localhost:3000` | Landing URL for the browser tool |
| `OM_AGENT_BROWSER_CDP_PORT` | ephemeral | `--remote-debugging-port` value |

Secrets: none. No new credentials.

## 7. Design-gate questions for the Architect

1. **Server shape:** standalone `browser_debug mcp:serve-browser` stdio MCP server
   (recommended, composes with R1) vs. only an in-app tool. I recommend **both**,
   as §3.2.
2. **ACL scope:** grant to admin+superadmin (recommended). Should non-admin
   developer roles ever get it? (Recommend: no.)
3. **`read_dom` truncation ceiling:** propose e.g. first 8 KB of innerText /
   16 KB of serialized HTML. Confirm ceiling is acceptable for the debug use case.

## 8. Implementation plan (post design-approval)

1. Scaffold `apps/mercato/src/modules/browser_debug/` (acl, setup, index).
2. `lib/loopback-guard.ts` + unit tests (loopback pass, non-loopback reject,
   env-flag fail-closed).
3. `lib/browser-debug.ts` CDP driver + verb implementations.
4. `ai-tools.ts` tool aliases; `cli.ts` `mcp:serve-browser` MCP server.
5. Register in `modules.ts`; `yarn generate`; `yarn typecheck` + `yarn lint`.
6. Integration: ephemeral app + agent-driven `open→screenshot` lands on a record.
7. Negative test: flag unset ⇒ tools absent / server refuses.
8. Docs (mcp.mdx section) + close gate.

## 9. Verification summary (evidence for the gate)

- Positive: ephemeral app, agent calls `browser_debug.open` +
  `browser_debug.screenshot`, screenshot artifact saved & referenced.
- Negative: `OM_ENABLE_AGENT_BROWSER_DEBUG` unset ⇒ `mcp:list-tools` shows no
  `browser_debug.*` and any direct call fails closed.
