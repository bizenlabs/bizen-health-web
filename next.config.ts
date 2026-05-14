import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Patient photo uploads run through the registerPatientAction. Client
      // resizes to ≤ 60KB JPEGs, but the body limit needs headroom for the
      // multipart envelope + other fields. Default is 1MB; core caps at 1MB
      // for the photo itself.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
