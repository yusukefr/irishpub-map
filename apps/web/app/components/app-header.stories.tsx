import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppHeader } from "./app-header";

const meta = {
  title: "Public/AppHeader",
  component: AppHeader,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 日本語の公開ナビゲーションを確認する基準Storyです。 */
export const Japanese: Story = {
  args: {
    locale: "ja",
    navigationItems: [{ href: "/discover", label: "Explore Ireland", current: true }],
  },
};

/** 英語の公開ナビゲーションでラベル長を確認するStoryです。 */
export const English: Story = {
  args: {
    locale: "en",
    navigationItems: [{ href: "/discover", label: "Explore Ireland", current: true }],
  },
};
