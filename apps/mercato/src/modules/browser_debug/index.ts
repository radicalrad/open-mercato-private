import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'browser_debug',
  title: 'Browser Debug',
  version: '0.1.0',
  description:
    'Local Chrome/Edge browser debug tool for agents (Playwright + CDP remote debugging via a browser MCP server). Fail-closed, loopback-only.',
  author: 'Open Mercato Team',
  license: 'MIT',
}
