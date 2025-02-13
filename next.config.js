/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure env vars are loaded
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

module.exports = nextConfig;
