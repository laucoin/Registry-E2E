import type { Locator, Page } from '@playwright/test';

/** Remplit le formulaire de connexion d'un fournisseur d'identité une fois le navigateur redirigé vers lui. */
export interface IdpAdapter {
	login(page: Page, username: string, password: string): Promise<void>;
	/** Le message que l'IdP affiche après un échec d'authentification. */
	authenticationError(page: Page): Locator;
	/** Ramène le navigateur vers l'application après la déconnexion, quand l'IdP s'arrête sur sa propre page de déconnexion. */
	returnToAppAfterLogout(page: Page): Promise<void>;
}
