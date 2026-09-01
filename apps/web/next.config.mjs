import createNextIntlPlugin from 'next-intl/plugin'

// Points at the request config that loads catalogs from `packages/i18n`.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // QA builds can use an isolated directory without corrupting a running dev server.
  // Production keeps Next.js' standard `.next` output unless explicitly overridden.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@bliss/types', '@bliss/i18n'],
  images: {
    remotePatterns: [{ hostname: 'images.unsplash.com' }],
  },
}

export default withNextIntl(nextConfig)
