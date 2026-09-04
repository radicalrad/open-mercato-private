import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    // Browser debug is a privileged local introspection capability: grant to
    // superadmin + admin only, never employee. Enforcement remains belt-and-
    // braces — every verb still hits the OM_ENABLE_AGENT_BROWSER_DEBUG fail-
    // closed gate, so even admins cannot use it unless the flag is explicitly
    // set (which it must not be in production).
    superadmin: ['browser_debug.*'],
    admin: ['browser_debug.*'],
  },
}

export default setup
