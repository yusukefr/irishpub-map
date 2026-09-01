declare module "*.mdx" {
  const MDXComponent: import("mdx/types").MDXContent;
  export default MDXComponent;
  export const metadata: import("./app/lib/content/types").ContentArticleMetadata;
}
