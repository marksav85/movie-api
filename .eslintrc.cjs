module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: "eslint:recommended",
  ignorePatterns: ["out/", "playbook/", "node_modules/"],
  overrides: [
    {
      files: ["tests/**/*.js"],
      globals: {
        after: "readonly",
        before: "readonly",
        test: "readonly",
      },
    },
  ],
  rules: {
    "no-console": "off",
    "no-unused-vars": "warn",
  },
};
