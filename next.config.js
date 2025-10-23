/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
  // Exclude Firebase Functions directory from Next.js build
  experimental: {
    outputFileTracingExcludes: {
      '*': ['./functions/**/*'],
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      // Prefer browser conditions when packages export multiple entry points
      config.resolve.conditionNames = [
        'browser',
        'import',
        'module',
        'default',
        ...(config.resolve.conditionNames || []),
      ];
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        // Do not bundle Node's undici into the browser; browsers have native fetch
        undici: false,
        'undici/': false,
      };
      // Also ensure webpack will not try to polyfill/resolve 'undici'
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        undici: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
