import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'rate_limiting',
  title: 'Control-Plane Rate Limiting',
  version: '0.1.0',
  description:
    'Interceptor overlay that bounds authenticated control-plane (management) API traffic beyond auth.',
  author: 'Open Mercato Team',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
