# browser_debug (app overlay module)

Local Chrome/Edge browser debug tool for Open Mercato agents, added as an
`@app` overlay extension (AI-28 R2). It launches a real local browser over
CDP (`--remote-debugging-port`) using the Playwright already vendored in
`node_modules` and drives it toward the app URL (default `http://localhost:3000`).

## Security model (fail closed)

- The entire capability is **off unless** `OM_ENABLE_AGENT_BROWSER_DEBUG=1`.
  Unset/`0`/anything else disables it. Production must keep it unset.
- **Loopback-only** targets: `http(s)://localhost:*`, `127.0.0.1:*`, `[::1]:*`.
  All other hosts and schemes (`file:`, `javascript:`, remote IPs) are refused.
- ACL `browser_debug.debug` is granted to `superadmin` + `admin` only.
- No tenant data is read or written — the tool introspects the developer's own
  running app purely for debugging.

## Verbs

| Tool | Purpose |
|------|---------|
| `browser_debug.open` / `navigate` | goto a loopback URL |
| `browser_debug.screenshot` | persist a debug artifact, return its path |
| `browser_debug.read_dom` | read page body text (truncated ~8 KB) |
| `browser_debug.read_console` | console entries since navigation |
| `browser_debug.click` | click a CSS selector |
| `browser_debug.back` | history back |

## Two consumption surfaces

1. **In-app AI tool** (`ai-tools.ts`) — registered via `ai-tools.generated.ts`
   so the agent playground toolset and the in-app `mcp:list-tools` see
   `browser_debug.*` (empty when the flag is unset).
2. **Standalone MCP server** (`cli.ts`) — `mercato browser_debug mcp:serve-browser`
   serves a stdio MCP server for the R1 MCP path / external coding CLIs.

Both share `lib/browser-debug.ts` (driver) and `lib/loopback-guard.ts` (policy).

## Configuration

| Env | Default | Meaning |
|-----|---------|---------|
| `OM_ENABLE_AGENT_BROWSER_DEBUG` | unset | must equal `1` to enable (fail closed) |
| `OM_AGENT_BROWSER_URL` | `http://localhost:3000` | landing URL |
| `OM_AGENT_BROWSER_CDP_PORT` | ephemeral | `--remote-debugging-port` value |
| `OM_AGENT_BROWSER_EXECUTABLE` | auto | explicit browser executable path |
| `OM_AGENT_BROWSER_CHANNEL` | auto | `chrome` / `msedge` / playwright channel |
| `OM_AGENT_BROWSER_ARTIFACT_DIR` | tmpdir | where screenshots land |

No new secrets.
