import { expect, test } from '@fixtures/test.fixture';

/** Objectif: Couvrir ce qu'un visiteur non connecté peut voir | Périmètre: pages légales, fournisseur d'identité injoignable | Limites: sans connexion */
test.describe('Anonymous visitor', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('AUTH-04 · the terms and the privacy policy can be read without signing in', async ({ page, session }) => {
		await test.step('The privacy policy', async () => {
			await session.visit('/privacy');
			await expect(page).toHaveTitle(/Politique de confidentialité/);
			await expect(page).toHaveURL(/\/privacy$/);
		});

		await test.step('The terms of use', async () => {
			await session.visit('/terms');
			await expect(page).toHaveTitle(/Conditions d'utilisation/);
			await expect(page).toHaveURL(/\/terms$/);
		});
	});

	test('AUTH-03 · an unreachable identity provider leads to the global error page', async ({
		globalError,
		session,
	}) => {
		await test.step('Signing in fails on the global error page', async () => {
			await session.visit('/login');
			await session.makeIdentityProviderUnreachable();
			await session.loginButton.click();
			await expect(globalError.callout).toBeVisible();
		});
	});

	test('AUTH-07 · the sign-in page links to the configured support', async ({ session }) => {
		await test.step('The support link is under the sign-in button', async () => {
			await session.visit('/login');
			await expect(session.loginButton).toBeVisible();
			await expect(session.loginSupportLink).toHaveAttribute('href', /^https:\/\//);
			await expect(session.loginSupportLink).toHaveAttribute('target', '_blank');
		});
	});
});
