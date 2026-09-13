/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
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
  reactCompiler: true,
};

export default nextConfig;
