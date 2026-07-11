import antfu from '@antfu/eslint-config';
import prettierConflicts from 'eslint-config-prettier';

export default antfu(
    {
        type: 'app',
        react: true,
        nextjs: true,
        typescript: true,

        // Formatting is owned by Prettier — keep ESLint focused on correctness/logic rules only.
        stylistic: false,
        formatters: false,

        ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'raw/**'],
    },
    prettierConflicts,
    {
        rules: {
            // We're ESM-only (Bun/Next); the global `process` is the idiomatic way to reach it.
            'node/prefer-global/process': 'off',
        },
    },
);
