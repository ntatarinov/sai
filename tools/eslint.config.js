import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["src/pixel-office/public/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["src/web/public/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["src/picker/public/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
