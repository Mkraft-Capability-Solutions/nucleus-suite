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
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
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
