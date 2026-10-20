import baseConfig from '@englove/eslint-config';

export default [
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...baseConfig,
];
