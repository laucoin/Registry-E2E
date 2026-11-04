import { defineConfig } from '@playwright/test';

import { defineBddConfig } from 'playwright-bdd';

import type { ProjectRole } from '@/support/permissions';

import 'dotenv/config';

const testDir = defineBddConfig({
	// FEATURES=chemin1,chemin2 restreint l'exécution à certains fichiers feature (bddgen refuse de générer s'il manque des steps).
	features: process.env.FEATURES?.split(',') ?? 'features/**/*.feature',
	steps: ['support/fixtures.ts', 'support/steps/**/*.ts'],
});

export default defineConfig<{ role: ProjectRole }>({
	testDir,
	// Les scripts npm exécutent deux phases et fusionnent leurs blobs en un seul rapport HTML (voir package.json) ; une exécution unique produit directement du HTML.
	reporter: process.env.PW_BLOB ? [['blob'], ['list']] : [['html', { open: 'never' }], ['list']],
	globalSetup: './support/global-setup.ts',
	use: {
		baseURL: process.env.BASE_URL ?? 'http://localhost:4200',
		testIdAttribute: 'data-testid',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	retries: 1,
	// Le backend limite le débit des rafales de connexions, que de nombreux workers provoquent : quatre est le maximum qui reste stable.
	workers: 4,
	// Les scénarios tagués @exclusive modifient un compte de départ (blocage, rétrogradation, suppression) : ils s'exécutent seuls, après les autres
	// (les scripts npm exécutent les deux phases l'une après l'autre).
	projects: [
		{ name: 'parallel', grepInvert: /@exclusive/ },
		// Les scénarios @all-roles tournent aussi avec les autres rôles de projet (l'administrateur est le projet « parallel »).
		{
			name: 'role-coordinator',
			grep: /@all-roles/,
			grepInvert: /@exclusive/,
			use: { role: 'PROJECT_COORDINATOR' },
		},
		{
			name: 'role-participant',
			grep: /@all-roles/,
			grepInvert: /@exclusive/,
			use: { role: 'PROJECT_PARTICIPANT' },
		},
		{ name: 'exclusive', grep: /@exclusive/, fullyParallel: false, workers: 1 },
		// Contrôle que la matrice des permissions du backend est celle que la doc décrit (pas de scénarios Gherkin : un test Playwright direct).
		{ name: 'matrix', testDir: './tests' },
	],
});
