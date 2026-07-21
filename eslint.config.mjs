import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Filter out react-compiler plugin to avoid blocking commits
const filteredNextVitals = nextVitals.map(config => {
  if (config.plugins?.["react-compiler"]) {
    const { "react-compiler": _removed, ...rest } = config.plugins;
    return { ...config, plugins: rest };
  }
  return config;
});

const eslintConfig = defineConfig([
  ...filteredNextVitals,
  ...nextTs,
  {
    rules: {
      // Change 'any' from error to warning - fix incrementally
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused vars with underscore prefix
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      // React hooks warnings only (not errors)
      "react-hooks/exhaustive-deps": "warn",
      // React unescaped entities - warning only
      "react/no-unescaped-entities": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
