import type { Page } from '@playwright/test';

import type { Account } from '@/support/accounts';
import { password } from '@/support/accounts';
import { idp } from '@/support/idp';
import { withRetries } from '@/support/retry';

const ATTEMPTS = 3;
const RETRY_PAUSE_MS = 6_000;

/**
 * Se connecte via le fournisseur d'identité dans cette page, pour les scénarios qui ont besoin d'une session à eux.
 * Le backend limite le débit des connexions : une tentative refusée est donc retentée après une pause.
 */
export async function liveLogin(page: Page, account: Account): Promise<void> {
	await withRetries(() => attemptLogin(page, account), ATTEMPTS, RETRY_PAUSE_MS);
}

async function attemptLogin(page: Page, account: Account): Promise<void> {
	await page.context().clearCookies();
	await page.goto('/login');
	await page.getByTestId('login-submit-button').click();
	await idp().login(page, account, password());
	await page.getByTestId('navbar-account-menu-button').waitFor({ timeout: 15_000 });
}
