import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-plugin-react does not yet support ESLint 10; retain all other Next.js lint rules.
const disabledReactRules = Object.fromEntries(
  [...nextVitals, ...nextTypescript]
    .flatMap(({ rules = {} }) => Object.keys(rules))
    .filter((ruleName) => ruleName.startsWith("react/"))
    .map((ruleName) => [ruleName, "off"])
);

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: disabledReactRules
  },
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "node_modules/**"
    ]
  }
]);
