import { type Browser, chromium, type FullConfig, request, selectors } from '@playwright/test';

import { type Account, ACCOUNTS, authFile, password } from '@support/accounts';
import { defined } from '@support/defined';
import { idp } from '@support/idp';
import { withRetries } from '@support/retry';

const ATTEMPTS = 3;
const RETRY_PAUSE_MS = 5_000;

async function signIn(browser: Browser, baseURL: string, account: Account): Promise<void> {
	const context = await browser.newContext({ baseURL });
	try {
		const page = await context.newPage();
		await page.goto('/');
		await page.getByTestId('login-submit-button').click();
		await idp().login(page, account, password());
		// La session n'est utilisable qu'une fois que l'application a traité le callback et affiché son shell.
		await page.getByTestId('navbar-account-menu-button').waitFor({ timeout: 15_000 });
		// L'application mémorise sa langue dans un cookie : les features, les formats de date et les libellés sont français pour tous les comptes.
		await context.addCookies([{ name: 'locale', value: 'fr', url: baseURL }]);
		await context.storageState({ path: authFile(account) });
	} finally {
		await context.close();
	}
}

async function signInWithRetries(browser: Browser, baseURL: string, account: Account): Promise<void> {
	await withRetries(() => signIn(browser, baseURL, account), ATTEMPTS, RETRY_PAUSE_MS).catch((error: unknown) => {
		throw new Error(`Could not sign in "${account}"`, { cause: error });
	});
}

/** Lectures appelées une fois avant les tests : juste après un redémarrage, le backend répond lentement à ses premières requêtes. */
const WARM_UP_PATHS = ['/authentication/user/current', '/projects?size=5', '/users/profiles?size=5', '/users?size=5'];

async function warmUpBackend(): Promise<void> {
	const api = await request.newContext({
		baseURL: process.env.API_URL ?? 'http://localhost:8081',
		storageState: authFile('administrator'),
	});
	try {
		for (const path of WARM_UP_PATHS) await api.get(`/api/v2${path}`);
	} finally {
		await api.dispose();
	}
}

// Connecte chaque compte de départ utilisable une fois via le fournisseur d'identité configuré (variable IDP)
// et stocke sa session dans .auth/. Plusieurs tentatives car le backend limite le débit des connexions.
export default async function globalSetup(config: FullConfig): Promise<void> {
	const baseURL = defined(config.projects[0].use.baseURL);
	// Le navigateur du setup ne reçoit pas la config `use` des tests : l'attribut des test-ids doit être redéclaré ici.
	selectors.setTestIdAttribute(defined(config.projects[0].use.testIdAttribute));
	const browser = await chromium.launch();
	try {
		for (const account of ACCOUNTS) {
			await signInWithRetries(browser, baseURL, account);
		}
	} finally {
		await browser.close();
	}
	await warmUpBackend();
}
