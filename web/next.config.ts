import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app dir (a stray lockfile in $HOME otherwise
  // confuses Turbopack's root inference).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
