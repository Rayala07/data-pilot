import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a standalone bundle so the Docker runner stage only ships
  // server.js + the files it actually imports — no devDependencies needed.
  output: "standalone",
};

export default nextConfig;
