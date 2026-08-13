import createNextIntlPlugin from 'next-intl/plugin'

// Points at the request config that loads catalogs from `packages/i18n`.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@bliss/types', '@bliss/i18n'],
  images: {
    remotePatterns: [{ hostname: 'images.unsplash.com' }],
  },
}

export default withNextIntl(nextConfig)
