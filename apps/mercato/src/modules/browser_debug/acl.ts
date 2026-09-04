export const features = [
  {
    id: 'browser_debug.debug',
    title: 'Use browser debug tool',
    description:
      'Allows agents (and MCP clients) to drive a local Chrome/Edge over CDP via the browser_debug tool. Strictly local + fail-closed (OM_ENABLE_AGENT_BROWSER_DEBUG=1).',
    module: 'browser_debug',
  },
]

export default features
