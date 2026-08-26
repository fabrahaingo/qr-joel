// @ts-check

import { defineConfig } from "eslint/config";

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import prettierConfig from "eslint-config-prettier";

export default defineConfig(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js"],
        },
      },
    },
  },
  {
    rules: {
      // The test runner strips types without resolving them, so a type
      // imported as a value stays in the emitted import and fails at runtime.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },
  {
    // `test()` and `describe()` from node:test return a promise that the
    // runner awaits itself.
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  prettierConfig,
  eslintPluginPrettierRecommended,
);
