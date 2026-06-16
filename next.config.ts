import type { NextConfig } from "next";

const devDistDir = process.env.NEXT_DIST_DIR ?? ".next-local";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? devDistDir : ".next",
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
