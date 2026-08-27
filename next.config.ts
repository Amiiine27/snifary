import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // avatar Google par defaut
    ],
  },
  experimental: {
    serverActions: {
      // Defaut 1mb : trop juste pour une photo de telephone (parfum ou avatar),
      // encore moins une fois recadree/reencodee en PNG (fond transparent).
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
