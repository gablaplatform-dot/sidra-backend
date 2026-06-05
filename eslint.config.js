import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["admin_ui/dist/**", "node_modules/**"]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "error",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  },
  prettier
];
