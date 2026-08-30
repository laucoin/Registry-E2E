// @ts-check
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

/**
 * Formatting mirrors Registry-Frontend (see its eslint.config.mjs and the
 * stylistic block in its nuxt.config.ts): tab indentation, single quotes,
 * else/catch on the closing-brace line, no spaces inside array brackets.
 * This repo has no Nuxt layer, so the same @stylistic base is applied
 * directly instead of through @nuxt/eslint. Two carve-outs, same as
 * Registry-Frontend: indent-binary-ops is off (continuations follow the IDE's
 * continuation indent, which the rule cannot express) and smart-tabs allows
 * tabs for indent with spaces for alignment. Plain .mjs files keep the IDE
 * default scheme: 4-space indentation, no spaces inside object braces.
 */
export default tseslint.config(
    {ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', '.auth/**']},
    {
        files: ['**/*.ts', '**/*.mts'],
        plugins: {'@typescript-eslint': tseslint.plugin},
        languageOptions: {parser: tseslint.parser},
        rules: {
            /**
             * House rule shared with the frontend (see Registry-Frontend
             * eslint.config.mjs and AGENTS.md).
             */
            '@typescript-eslint/no-explicit-any': 'error',
        },
    },
    stylistic.configs.customize({
        indent: 'tab',
        quotes: 'single',
        braceStyle: '1tbs',
    }),
    {
        rules: {
            '@stylistic/array-bracket-spacing': ['error', 'never'],
            '@stylistic/indent-binary-ops': 'off',
            '@stylistic/no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],
        },
    },
    {
        files: ['**/*.mjs'],
        rules: {
            '@stylistic/indent': ['error', 4],
            '@stylistic/object-curly-spacing': ['error', 'never'],
        },
    },
)
