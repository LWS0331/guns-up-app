/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  optimizeFonts: true,
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material', 'recharts', 'posthog-js'],
  },
  // Redirects — defensive routing for retired URLs
  async redirects() {
    return [
      {
        // Old marketing campaigns linked to /trainers — route to the
        // /trainer-apply coming-soon screen until the new license
        // program goes public. Permanent (301) so search engines update.
        source: '/trainers',
        destination: '/trainer-apply',
        permanent: true,
      },
    ];
  },
  // Security + caching headers
  async headers() {
    return [
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
      {
        // Cache static assets aggressively (JS/CSS bundles are content-hashed by Next.js)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Cache images/icons for 1 day
        source: '/(.*\\.(?:ico|png|svg|jpg|jpeg|webp))',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=43200' },
        ],
      },
      {
        // Cache service worker — short TTL so updates propagate quickly
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        // Cache manifest
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
