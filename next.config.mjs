/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  swcMinify: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client'],
  },
};

export default nextConfig;
