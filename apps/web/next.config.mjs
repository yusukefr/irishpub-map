import createMDX from "@next/mdx";

const withMDX = createMDX({
  options: {},
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  cacheComponents: true,
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  transpilePackages: ["@irishpub-map/shared"],
};

export default withMDX(nextConfig);
