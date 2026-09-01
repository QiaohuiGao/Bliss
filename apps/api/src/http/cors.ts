function validOrigin(value: string, production: boolean) {
  try {
    const url = new URL(value.trim())
    if (url.origin !== value.trim().replace(/\/$/, '')) return null
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (production && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function configuredWebOrigins(env: NodeJS.ProcessEnv): string[] {
  const production = env['NODE_ENV'] === 'production'
  const configured = [
    env['WEB_URL'] ?? 'http://localhost:3000',
    ...(env['WEB_PREVIEW_URLS'] ?? '').split(','),
  ]
  const origins = configured
    .map(value => validOrigin(value, production))
    .filter((value): value is string => Boolean(value))

  if (!production) origins.push('http://localhost:3000', 'http://localhost:19006')
  return [...new Set(origins)]
}
