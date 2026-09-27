const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["out/**", "playbook/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        after: "readonly",
        before: "readonly",
        test: "readonly",
      },
    },
  },
];
