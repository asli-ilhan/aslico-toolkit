import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@aslico/core', '@aslico/ui', '@aslico/ai', '@aslico/storage'],
}

export default nextConfig
