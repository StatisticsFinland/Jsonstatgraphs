// @ts-check
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["dist/**", "storybook-static/**", "agent_tmp/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  // Global: ignore _-prefixed intentionally unused variables (standard convention)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  // Tests and stories legitimately use `any` for mocks and Storybook args
  {
    files: ["tests/**/*.ts", "stories/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tests/tsconfig.json",
      },
    },
  },
  {
    files: ["stories/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./stories/tsconfig.json",
      },
    },
  },
);
