// @ts-check
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-dynamic-delete': 'error',
      'vue/multi-word-component-names': 'off',
      // Nuxt UI's types pull in @nuxt/schema, which declares a global $fetch,
      // so vue-tsc accepts it even though nothing defines it at runtime.
      'no-restricted-globals': [
        'error',
        { name: '$fetch', message: 'Nuxt-only. Use fetch().' },
      ],
    },
  },
  prettier, // Must be last. Disables conflicting stylistic rules.
);
