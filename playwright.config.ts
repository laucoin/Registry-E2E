import { defineConfig } from '@playwright/test';

import { authFile } from '@support/accounts';

import 'dotenv/config';

export default defineConfig({
	testDir: './specs',
	// Les scripts npm exécutent deux phases et fusionnent leurs blobs en un seul rapport HTML (voir package.json) ; une exécution unique produit directement du HTML.
	reporter: process.env.PW_BLOB ? [['blob'], ['list']] : [['html', { open: 'never' }], ['list']],
	globalSetup: './support/global-setup.ts',
	use: {
		baseURL: process.env.BASE_URL ?? 'http://localhost:4200',
		// Le frontend pose `data-test-id` sur chaque élément interactif (et non le `data-testid` par défaut de Playwright).
		testIdAttribute: 'data-test-id',
		// Les libellés vérifiés sont ceux de l'interface française, que la locale du navigateur choisit en l'absence de préférence enregistrée.
		locale: 'fr-FR',
		// Un test démarre connecté en administrateur de la plateforme ; ceux qui ont besoin d'un autre compte le déclarent avec `test.use`.
		storageState: authFile('administrator'),
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	retries: 1,
	// Le backend limite le débit des rafales de connexions, que de nombreux workers provoquent : quatre est le maximum qui reste stable.
	workers: 4,
	// Les tests tagués @exclusive modifient un compte de départ (blocage, rétrogradation, suppression) ou se connectent par l'IdP, dont le
	// backend limite le débit : ils s'exécutent seuls, après les autres
	// (les scripts npm exécutent les deux phases l'une après l'autre, pour qu'un échec de la première n'empêche pas la seconde).
	projects: [
		{ name: 'parallel', grepInvert: /@exclusive/ },
		{ name: 'exclusive', grep: /@exclusive/, fullyParallel: false, workers: 1 },
	],
});
