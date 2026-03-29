/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@bliss/types'],
  images: {
    remotePatterns: [{ hostname: 'images.unsplash.com' }],
  },
}

export default nextConfig
