/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  optimizeFonts: true,
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
};

module.exports = nextConfig;
