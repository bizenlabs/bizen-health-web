import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only needed for the container path (Dockerfile -> ECS).
  // Vercel wants the default .next output, so gate this on BUILD_TARGET. The
  // Dockerfile sets BUILD_TARGET=docker; Vercel builds leave it unset.
  output: process.env.BUILD_TARGET === "docker" ? "standalone" : undefined,
};

export default nextConfig;
