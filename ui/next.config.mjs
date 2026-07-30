/** @type {import('next').NextConfig} */

// Proxies /api/* to the FastAPI backend, so the browser only ever talks to one
// origin. Without this you fight CORS and mixed-content (HTTPS page calling an
// HTTP backend) — and mixed content fails silently, which is the worst kind.
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
    ]
  },
}

export default nextConfig
