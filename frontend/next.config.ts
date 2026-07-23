import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import path from "path";

const nextConfig: NextConfig = {
  // output: "standalone" is only needed for Docker deployments.
  // Vercel handles Next.js natively - do not set this here.

  // Tell Turbopack that this directory is the workspace root, not the monorepo
  // root. Without this, Next.js detects two package-lock.json files and warns.
  turbopack: {
    root: path.resolve(__dirname),
  },
};


const withMDX = createMDX();

export default withMDX(nextConfig);
