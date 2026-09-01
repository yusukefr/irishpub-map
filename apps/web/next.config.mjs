import createMDX from "@next/mdx";

const withMDX = createMDX({
  options: {},
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  transpilePackages: ["@irishpub-map/shared"],
};

export default withMDX(nextConfig);
