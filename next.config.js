/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://app.copper.com',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://app.copper.com;",
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
