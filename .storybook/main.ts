import type { StorybookConfig } from "@storybook/nextjs-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../apps/web/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  viteFinal(config) {
    // workspaceルートからの起動でもWebと同じTailwind処理を使用します。
    config.css = { ...config.css, postcss: fileURLToPath(new URL("../apps/web", import.meta.url)) };
    return config;
  },
};

export default config;
