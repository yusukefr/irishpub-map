/** @type {import("next").NextConfig} */
const nextConfig = {
  skipProxyUrlNormalize: true,
  transpilePackages: ["@irishpub-map/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
