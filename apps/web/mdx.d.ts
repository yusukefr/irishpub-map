import type { ContentArticleMetadata } from "./app/lib/content/types";
import type { MDXContent } from "mdx/types";

declare module "*.mdx" {
  const MDXComponent: MDXContent;
  export default MDXComponent;
  export const metadata: ContentArticleMetadata;
}
