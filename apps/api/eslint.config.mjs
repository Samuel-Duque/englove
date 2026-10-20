import baseConfig from '@englove/eslint-config';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'prisma/migrations/**'],
  },
  ...baseConfig,
];
