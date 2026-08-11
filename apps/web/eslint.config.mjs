import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import * as eslintReact from "@eslint-react/eslint-plugin";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "node_modules/**"
    ]
  },
  // Map the "react" plugin id to the new package so existing rule names keep working
  {
    plugins: {
      react: eslintReact
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  }
]);
