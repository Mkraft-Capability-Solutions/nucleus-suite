import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Isolate local compiler verification from a running development server.
  distDir: process.env.NUCLEUS_ISOLATED_BUILD === 'true' ? 'build' : '.next',
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }];
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
    // Client-only production obfuscation: hard excludes node_modules and server bundles
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
