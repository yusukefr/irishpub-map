import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MediaPicker } from "./media-picker";

const meta = {
  title: "Admin/MediaPicker",
  component: MediaPicker,
  args: {
    locale: "ja",
    selectedId: null,
    triggerLabel: "画像を選択",
    onSelect: () => undefined,
  },
} satisfies Meta<typeof MediaPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 選択操作とDialogのアクセシビリティを確認する基準Storyです。 */
export const Default: Story = {};
