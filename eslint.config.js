import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
	{
		ignores: [
			'node_modules/**',
			'blob-report/**',
			'playwright-report/**',
			'test-results/**',
			'.auth/**',
			'coverage/**',
			'*.d.ts',
		],
	},

	// 1. Configuration globale TypeScript & Page Objects
	{
		files: ['**/*.ts'],
		plugins: {
			'simple-import-sort': simpleImportSort,
		},
		extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...tseslint.configs.strict],
		rules: {
			// Tri et groupement des imports
			'simple-import-sort/imports': [
				'error',
				{
					groups: [
						['^@playwright/test'], // 1. Runner Playwright
						['^@?\\w'], // 2. Librairies tierces
						['^@(components|fixtures|pages|support)/'], // 3. Alias internes (Page Objects, composants, fixtures, outillage)
					],
				},
			],
			'simple-import-sort/exports': 'error',

			// Interdiction stricte des imports relatifs
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['../*'],
							message:
								'Relative parent imports are prohibited. Use an alias (@pages/, @components/, @fixtures/, @support/).',
						},
						{
							group: ['./*'],
							message:
								'Relative current directory imports are prohibited. Use an alias (@pages/, @components/, @fixtures/, @support/).',
						},
					],
				},
			],

			// TypeScript strict & anti-bruit
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-inferrable-types': 'error',
			'@typescript-eslint/explicit-member-accessibility': [
				'error',
				{
					accessibility: 'explicit',
					overrides: { constructors: 'no-public' },
				},
			],

			// Les membres privés (propriétés, méthodes, paramètres de constructeur) sont préfixés par « _ »
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: ['classProperty', 'classMethod', 'parameterProperty', 'accessor'],
					modifiers: ['private'],
					format: null,
					leadingUnderscore: 'require',
				},
			],

			// Métriques de complexité
			'max-depth': ['error', 2],
			complexity: ['error', { max: 4 }],
			'max-lines-per-function': ['error', { max: 25, skipBlankLines: true, skipComments: true }],
			'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
			'@typescript-eslint/max-params': ['error', { max: 7 }],
			'no-param-reassign': ['error', { props: true }],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
			],
			// Fixtures Playwright : `async ({}, use)`
			'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
		},
	},

	// 2. Règles spécifiques aux suites de tests E2E (*.spec.ts / *.test.ts)
	{
		files: ['**/*.{spec,test}.ts'],
		...playwright.configs['flat/recommended'],
		rules: {
			...playwright.configs['flat/recommended'].rules,

			// Sécurité Playwright
			'playwright/no-focused-test': 'error', // Interdit d'oublier un test.only() en commit
			'playwright/no-skipped-test': 'warn', // Avertit sur les test.skip()
			'playwright/no-wait-for-timeout': 'error', // Interdit les attentes d'horloge arbitraires (waitForTimeout)
			'playwright/valid-expect': 'error', // Force le await sur les expect() asynchrones

			// Adaptations E2E : les blocs de test ont besoin de corps d'instructions
			'max-lines-per-function': [
				'error',
				{
					max: 70, // Un scénario complet (Arrange, Act, Assert en test.step) reste lisible jusqu'à 70 lignes
					skipBlankLines: true,
					skipComments: true,
				},
			],
			// Une spec trop longue se découpe en fichiers thématiques
			'max-lines': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
			// Une spec est linéaire : aucune branche ni boucle
			complexity: ['error', { max: 1 }],
			// On n'impose pas de type de retour explicite sur les lambdas de test()
			'@typescript-eslint/explicit-function-return-type': 'off',
		},
	},

	prettier,
);
