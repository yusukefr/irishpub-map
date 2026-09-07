import type { Preview } from "@storybook/nextjs-vite";
import "../apps/web/app/globals.css";

const preview = {
  parameters: {
    a11y: {
      test: "todo",
    },
    controls: { expanded: true },
  },
} satisfies Preview;

export default preview;
