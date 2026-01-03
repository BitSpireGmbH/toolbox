// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const yml = require("eslint-plugin-yml");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Modern Angular best practices
      "@angular-eslint/prefer-standalone": "error",
      "@angular-eslint/prefer-signals": "error",
      // No any type - enforce proper typing
      "@typescript-eslint/no-explicit-any": "error",
      // No non-null assertion operator (bang operator)
      "@typescript-eslint/no-non-null-assertion": "error",
      // Prefer inject() function over constructor injection
      "@angular-eslint/prefer-inject": "error",
      // Allow unused vars that start with underscore (for interface implementations)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
        }
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // No bang operator in templates
      "@angular-eslint/template/no-negated-async": "error",
    },
  },
  // YAML linting
  ...yml.configs['flat/recommended'],
  {
    files: ["**/*.yml", "**/*.yaml"],
    rules: {
      "yml/no-empty-mapping-value": "error",
      "yml/no-irregular-whitespace": "error",
    },
  }
]);
