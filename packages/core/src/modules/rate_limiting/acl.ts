// Control-plane rate limiting is an operational capability; it grants no user-facing
// permissions of its own (the module only acts as an interceptor overlay). We still
// declare a feature namespace so the module participates in the ACL exposure, RBAC
// sync, and OpenAPI generation uniformly with every other module.
export const features = [
  { id: 'rate_limiting.view', title: 'View control-plane rate limiting', module: 'rate_limiting' },
]

export default features
