import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" is only needed for Docker deployments.
  // Vercel handles Next.js natively — do not set this here.
};

export default nextConfig;
