import eslintPluginAstro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  ...eslintPluginAstro.configs['flat/recommended'],
  {
    // TypeScript frontmatter in .astro files (astro-eslint-parser delegates to this)
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: { parser: '@typescript-eslint/parser' },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },
];
