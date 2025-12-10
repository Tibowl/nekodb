import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      "prefer-const": "warn",
      "no-trailing-spaces": "error",
      "spaced-comment": "warn",
      quotes: ["warn", "double"],

      "no-multiple-empty-lines": ["error", {
        max: 2,
        maxBOF: 0,
        maxEOF: 0,
      }],

      semi: ["warn", "never"],
      "eol-last": "error",
      "no-useless-escape": "error",
      "object-curly-spacing": ["warn", "always"],
      "comma-spacing": "warn",
    },
  }
])
