/**
 * In-app AI tool aliases for the browser_debug capability.
 *
 * These are the "playground / agent-chat alias" surface (parent AUT-28 R2
 * requirement: "keep in-app tool alias for playground"). They share the same
 * fail-closed env gate + loopback guard as the standalone `browser_debug
 * mcp:serve-browser` MCP server (see `cli.ts`).
 *
 * Fail-closed registration: the tool set is only populated at module load when
 * `OM_ENABLE_AGENT_BROWSER_DEBUG=1`. With the flag unset, `aiTools` is empty so
 * the generated `ai-tools.generated.ts` registry drops this module entirely and
 * `mcp:list-tools` shows no `browser_debug.*`. Handlers additionally call
 * `assertBrowserDebugEnabled()` so even a stale registration fails closed.
 */
import { z } from 'zod'
import type { AiToolDefinition, McpToolContext } from '@open-mercato/ai-assistant/types'
import { isBrowserDebugEnabled } from './lib/loopback-guard'
import * as driver from './lib/browser-debug'

const feature = ['browser_debug.debug']

function tool<TInputSchema extends z.ZodType, TOutput>(
  name: string,
  description: string,
  inputSchema: TInputSchema,
  handler: (input: z.infer<TInputSchema>, context: McpToolContext) => Promise<TOutput>,
): AiToolDefinition {
  return { name, description, inputSchema, requiredFeatures: feature, isMutation: false, handler } as AiToolDefinition
}

const builtinTools: AiToolDefinition[] = [
  tool(
    'browser_debug.open',
    'Open / navigate the local app in a real Chrome/Edge (CDP). Loopback-only target (default http://localhost:3000).',
    z.object({ url: z.string().optional() }),
    async (input: { url?: string }) => driver.navigate(input.url),
  ),
  tool(
    'browser_debug.navigate',
    'Navigate the current local browser session to a loopback-only URL.',
    z.object({ url: z.string() }),
    async (input: { url: string }) => driver.navigate(input.url),
  ),
  tool(
    'browser_debug.screenshot',
    'Capture a screenshot of the current page and persist it as a debug artifact (returns the artifact path).',
    z.object({ path: z.string().optional() }),
    async (input: { path?: string }) => driver.screenshot(input.path),
  ),
  tool(
    'browser_debug.read_dom',
    'Read the current page body text (truncated to ~8KB) for debugging what the agent sees.',
    z.object({}),
    async () => driver.readDom(),
  ),
  tool(
    'browser_debug.read_console',
    'Read console.log/warn/error entries captured since navigation.',
    z.object({}),
    async () => driver.readConsole(),
  ),
  tool(
    'browser_debug.click',
    'Click an element on the current page by CSS selector.',
    z.object({ selector: z.string() }),
    async (input: { selector: string }) => driver.click(input.selector),
  ),
  tool(
    'browser_debug.back',
    'Go back one page in the local browser session.',
    z.object({}),
    async () => driver.goBack(),
  ),
]

/**
 * Registered tool set. Empty when the fail-closed env flag is not exactly
 * `'1'`, so the generator (ai-tools.generated.ts) omits this module from the
 * in-app tool registry / `mcp:list-tools`.
 */
export const aiTools: AiToolDefinition[] = isBrowserDebugEnabled() ? builtinTools : []

export default aiTools
