import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // /privacy and /terms read the draft legal text from docs/ in beta (ENG-25).
  outputFileTracingIncludes: {
    "/privacy": ["./docs/product/beta/legal/*.md"],
    "/terms": ["./docs/product/beta/legal/*.md"],
  },
};

export default nextConfig;
