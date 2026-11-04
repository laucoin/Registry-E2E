import type { IdpAdapter } from '@/support/idp/types';

// Authentik utilise un flux en plusieurs étapes : identification d'abord, puis mot de passe.
export const authentik: IdpAdapter = {
	async login(page, username, password) {
		await page.locator('input[name="uidField"]').fill(username);
		await page.keyboard.press('Enter');
		// L'étape d'identification est remplacée par l'étape de mot de passe ; remplir avant cela soumet trop tôt.
		await page.locator('input[name="uidField"]').waitFor({ state: 'detached' });
		await page.locator('input[name="password"]').fill(password);
		await page.keyboard.press('Enter');
	},
	authenticationError(page) {
		return page.locator('.pf-c-form__helper-text.pf-m-error');
	},
	// Authentik termine sur son flux d'invalidation avec un lien de retour vers l'application (paramètre redirect_uri).
	async returnToAppAfterLogout(page) {
		await page.waitForURL(/invalidation-flow/);
		const target = new URL(page.url()).searchParams.get('redirect_uri');
		await page.locator(`a[href="${target}"]`).click();
	},
};
