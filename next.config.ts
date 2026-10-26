import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify Drop / any static host: emit a fully static site into ./out.
  output: "export",
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
