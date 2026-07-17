import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  // output: "standalone" is only needed for Docker deployments.
  // Vercel handles Next.js natively - do not set this here.
};


const withMDX = createMDX();

export default withMDX(nextConfig);
