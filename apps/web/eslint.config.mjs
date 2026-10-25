import baseConfig from '@englove/eslint-config';

export default [
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...baseConfig,
  {
    files: ['src/components/activities/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*lib/api*', '**/lib/api**', '@/lib/api', '../lib/api', '../../lib/api'],
              message:
                'Frontera de módulo: src/components/activities/ no puede importar el cliente HTTP lib/api (SPEC-06 RF-1).',
            },
            {
              group: ['@tanstack/react-query', '@tanstack/react-query/*'],
              message:
                'Frontera de módulo: src/components/activities/ no puede importar @tanstack/react-query (SPEC-06 RF-1).',
            },
          ],
        },
      ],
    },
  },
];
