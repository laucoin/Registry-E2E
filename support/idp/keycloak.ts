import type { IdpAdapter } from '@/support/idp/types';

// Thème de connexion Keycloak par défaut : un seul formulaire avec identifiant et mot de passe.
export const keycloak: IdpAdapter = {
	async login(page, username, password) {
		await page.locator('#username').fill(username);
		await page.locator('#password').fill(password);
		await page.locator('#kc-login').click();
	},

	authenticationError(page) {
		return page.locator('#input-error, .alert-error, [data-testid="login-error"]').first();
	},

	// Keycloak redirige directement vers l'application après la déconnexion.
	async returnToAppAfterLogout() {},
};
