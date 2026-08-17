import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and finds a stray
  // package-lock.json in the home directory and warns about it on every start.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
