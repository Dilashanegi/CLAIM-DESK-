/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets Claude connect at https://your-app/mcp as well as /api/mcp.
  async rewrites() {
    return [{ source: "/mcp", destination: "/api/mcp" }];
  },
};

export default nextConfig;
