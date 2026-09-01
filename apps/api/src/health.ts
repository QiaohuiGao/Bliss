export interface DeploymentCapabilities {
  agent: boolean
  vendorSearch: boolean
  legalAuthority: boolean
  emailSend: boolean
  privateMedia: boolean
}

export type DeploymentCapability = keyof DeploymentCapabilities

const present = (env: NodeJS.ProcessEnv, key: string) => Boolean(env[key]?.trim())

const validEndpoint = (env: NodeJS.ProcessEnv, key: string) => {
  const value = env[key]?.trim()
  if (!value) return false
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return env['NODE_ENV'] !== 'production' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const validBucket = (value: string | undefined) => value
  ? /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value.trim())
  : false

export function deploymentCapabilities(env: NodeJS.ProcessEnv): DeploymentCapabilities {
  const provider = env['AGENT_MODEL_PROVIDER']?.trim().toLowerCase()
  const agent = provider === 'gemini'
    ? present(env, 'GEMINI_API_KEY') && present(env, 'GEMINI_MODEL')
    : provider === 'anthropic'
      ? present(env, 'ANTHROPIC_API_KEY') && present(env, 'ANTHROPIC_MODEL')
      : false
  return {
    agent,
    vendorSearch: validEndpoint(env, 'VENDOR_SEARCH_ENDPOINT') && present(env, 'VENDOR_SEARCH_TOKEN'),
    legalAuthority: validEndpoint(env, 'LEGAL_AUTHORITY_ENDPOINT') && present(env, 'LEGAL_AUTHORITY_TOKEN'),
    emailSend: validEndpoint(env, 'EMAIL_SEND_ENDPOINT') && present(env, 'EMAIL_SEND_TOKEN'),
    privateMedia: [
      'MEDIA_S3_REGION',
      'MEDIA_S3_ACCESS_KEY_ID',
      'MEDIA_S3_SECRET_ACCESS_KEY',
    ].every(key => present(env, key))
      && validEndpoint(env, 'MEDIA_S3_ENDPOINT')
      && validBucket(env['MEDIA_S3_BUCKET']),
  }
}

export function missingProductionConfiguration(env: NodeJS.ProcessEnv): string[] {
  const required = [
    'DATABASE_URL',
    'WEB_URL',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'CRON_SECRET',
    'OPS_SECRET',
    'AGENT_MODEL_PROVIDER',
  ]
  const missing = required.filter(key => !present(env, key))
  if (present(env, 'WEB_URL') && !validEndpoint(env, 'WEB_URL')) {
    missing.push('valid HTTPS WEB_URL')
  }
  if (!deploymentCapabilities(env).agent) missing.push('configured agent model')
  return missing
}

export function missingProductCapabilities(env: NodeJS.ProcessEnv): DeploymentCapability[] {
  const capabilities = deploymentCapabilities(env)
  return (Object.keys(capabilities) as DeploymentCapability[])
    .filter(capability => !capabilities[capability])
}
