import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build for Docker: emits .next/standalone/ with a minimal
  // node_modules and a server.js entry, so the runtime image doesn't ship
  // dev deps. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
