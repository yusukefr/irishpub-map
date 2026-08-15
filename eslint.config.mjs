import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import jsdoc from "eslint-plugin-jsdoc";

// eslint-plugin-react does not yet support ESLint 10; retain all other Next.js lint rules.
const disabledReactRules = Object.fromEntries(
  [...nextVitals, ...nextTypescript]
    .flatMap(({ rules = {} }) => Object.keys(rules))
    .filter((ruleName) => ruleName.startsWith("react/"))
    .map((ruleName) => [ruleName, "off"]),
);

const publicJSDocContexts = [
  "ExportNamedDeclaration > FunctionDeclaration",
  "ExportDefaultDeclaration > FunctionDeclaration",
  "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
  "ExportDefaultDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
  "ExportNamedDeclaration > ClassDeclaration",
  "ExportNamedDeclaration > TSInterfaceDeclaration",
  "ExportNamedDeclaration > TSTypeAliasDeclaration",
];

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: disabledReactRules,
  },
  {
    files: ["apps/web/app/**/*.{ts,tsx}", "packages/shared/src/**/*.{ts,tsx}"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/check-alignment": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": "error",
      "jsdoc/require-description": "error",
      "@next/next/no-html-link-for-pages": "off",
      "jsdoc/require-jsdoc": [
        "error",
        {
          contexts: publicJSDocContexts,
          require: {
            ArrowFunctionExpression: false,
            FunctionDeclaration: false,
            FunctionExpression: false,
          },
        },
      ],
      "jsdoc/require-param": ["error", { contexts: publicJSDocContexts }],
      "jsdoc/require-returns": ["error", { contexts: publicJSDocContexts }],
    },
  },
  {
    files: ["apps/web/app/**/*.{ts,tsx}", "packages/shared/src/**/*.{ts,tsx}"],
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-promise-executor-return": "error",
      "no-script-url": "error",
    },
  },
  {
    ignores: [".next/**", "next-env.d.ts", "node_modules/**"],
  },
]);
