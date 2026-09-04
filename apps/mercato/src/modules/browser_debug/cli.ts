/**
 * Module CLI for browser_debug.
 *
 * Provides the standalone `browser_debug mcp:serve-browser` stdio MCP server
 * so the R1 MCP path and external coding CLIs can drive the local app browser
 * over CDP. This is the "new server so R1 composes" surface; the in-app
 * `browser_debug.*` tools (ai-tools.ts) are the "alias for the playground".
 * Both share the same fail-closed gate + loopback guard.
 *
 * Fail closed: the server refuses to start unless `OM_ENABLE_AGENT_BROWSER_DEBUG=1`.
 */
import type { ModuleCli } from '@open-mercato/shared/modules/registry'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { z } from 'zod'
import { assertBrowserDebugEnabled } from './lib/loopback-guard'
import * as driver from './lib/browser-debug'

const schemas = {
  open: z.object({ url: z.string().optional() }),
  navigate: z.object({ url: z.string() }),
  screenshot: z.object({ path: z.string().optional() }),
  read_dom: z.object({}),
  read_console: z.object({}),
  click: z.object({ selector: z.string() }),
  back: z.object({}),
} as const

const TOOL_DEFS: { name: string; description: string; schema: z.ZodType }[] = [
  { name: 'browser_debug.open', description: 'Open/navigate the local app (loopback-only, default http://localhost:3000).', schema: schemas.open },
  { name: 'browser_debug.navigate', description: 'Navigate the current local browser session to a loopback-only URL.', schema: schemas.navigate },
  { name: 'browser_debug.screenshot', description: 'Capture a screenshot and persist it as a debug artifact (returns artifact path).', schema: schemas.screenshot },
  { name: 'browser_debug.read_dom', description: 'Read current page body text (truncated).', schema: schemas.read_dom },
  { name: 'browser_debug.read_console', description: 'Read console entries captured since navigation.', schema: schemas.read_console },
  { name: 'browser_debug.click', description: 'Click an element by CSS selector.', schema: schemas.click },
  { name: 'browser_debug.back', description: 'Go back one page.', schema: schemas.back },
]

async function dispatch(name: string, args: unknown): Promise<unknown> {
  assertBrowserDebugEnabled()
  switch (name) {
    case 'browser_debug.open':
      return driver.navigate((args as { url?: string }).url)
    case 'browser_debug.navigate':
      return driver.navigate((args as { url: string }).url)
    case 'browser_debug.screenshot':
      return driver.screenshot((args as { path?: string }).path)
    case 'browser_debug.read_dom':
      return driver.readDom()
    case 'browser_debug.read_console':
      return driver.readConsole()
    case 'browser_debug.click':
      return driver.click((args as { selector: string }).selector)
    case 'browser_debug.back':
      return driver.goBack()
    default:
      throw new Error(`Unknown browser_debug tool: ${name}`)
  }
}

const mcpServeBrowser: ModuleCli = {
  command: 'mcp:serve-browser',
  async run() {
    // Surface driver/Playwright logs on stderr so stdout stays a clean MCP
    // JSON-RPC stream.
    process.env.OM_LOG_DESTINATION = 'stderr'

    try {
      assertBrowserDebugEnabled()
    } catch (error) {
      // Fail closed with a non-zero exit so callers (MCP clients, coding CLIs)
      // see a hard failure, not a quietly-exiting 0. The dispatcher maps a
      // throw to exit 1; setting process.exitCode alone is ignored there.
      throw new Error(error instanceof Error ? error.message : String(error))
    }

    const server = new Server(
      { name: 'browser_debug', version: '0.1.0' },
      { capabilities: { tools: {} } },
    )

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFS.map((def) => ({
        name: def.name,
        description: def.description,
        inputSchema: zodToJsonSchema(def.schema as unknown as Parameters<typeof zodToJsonSchema>[0]) as Record<string, unknown>,
      })),
    }))

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name
      try {
        const result = await dispatch(name, request.params.arguments)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { isError: true, content: [{ type: 'text', text: message }] }
      }
    })

    const transport = new StdioServerTransport()
    try {
      await server.connect(transport)
    } catch (error) {
      console.error('browser_debug mcp:serve-browser failed to connect:', error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  },
}

export default [mcpServeBrowser]
