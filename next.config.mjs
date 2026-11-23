import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const developmentScriptPolicy = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${developmentScriptPolicy}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://ui-avatars.com",
  "font-src 'self' data:",
  "connect-src 'self' https: wss://generativelanguage.googleapis.com",
  // 'self': the document library shows a stored PDF or image in a frame on the same site.
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  distDir: process.env.NUCLEUS_ISOLATED_BUILD === 'true' ? 'build' : '.next',
  turbopack: {},
  experimental: { globalNotFound: true },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=()' },
      ],
    }, {
      // A stored document may be framed by this site's own pages (the document viewer), nowhere else.
      // Only checked file types are served (PDF, images without SVG, plain text); others download.
      source: '/api/v1/documents/library/:id/file',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
  },
  reactCompiler: true,
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      try {
        const WebpackObfuscator = require('webpack-obfuscator');
        config.plugins.push(
          new WebpackObfuscator(
            {
              compact: true,
              simplify: true,
              controlFlowFlattening: false,
              deadCodeInjection: false,
              stringArray: true,
              stringArrayThreshold: 0.5,
              rotateStringArray: true,
            },
            ['**/node_modules/**', '**/vendor/**']
          )
        );
      } catch (err) {
        console.warn('Webpack obfuscator load skipped:', err?.message || err);
      }
    }
    return config;
  },
};

export default nextConfig;
