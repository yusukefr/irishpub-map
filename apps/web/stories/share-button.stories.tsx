import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ShareButton } from "../app/components/share-button";
import { getPubUrl } from "../app/lib/public-url";

const meta = {
  title: "Design System/Share Button",
  component: ShareButton,
  args: { title: "Sample Pub", text: "Sample Pub | Irish Pub Map", url: getPubUrl("sample"), locale: "ja" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof ShareButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Japanese: Story = {};
export const English: Story = { args: { locale: "en" } };
