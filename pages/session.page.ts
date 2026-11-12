import type { Locator, Page } from '@playwright/test';

import { type Account, password } from '@support/accounts';
import { idp } from '@support/idp';

/**
 * Objectif: Se connecter et se déconnecter par l'interface | Périmètre: page de connexion, fournisseur d'identité, menu
 * du compte | Limites: les sessions préparées par le global setup ne doivent pas être déconnectées (elles sont partagées).
 */
export class SessionPage {
	public readonly loginButton: Locator;
	public readonly accountMenu: Locator;
	private readonly _logout: Locator;

	constructor(private readonly _page: Page) {
		this.loginButton = _page.getByTestId('login-submit-button');
		this.accountMenu = _page.getByTestId('navbar-account-menu-button');
		this._logout = _page.getByTestId('navbar-account-menu-item').filter({ hasText: 'Se déconnecter' });
	}

	/** Un lien du pied de page : `documentation`, `support`, `terms` ou `privacy`. */
	public footerLink(name: 'documentation' | 'support' | 'terms' | 'privacy'): Locator {
		return this._page.getByTestId(`footer-${name}-link`);
	}

	/** Le titre de page (`sgdf-page-title`) par lequel commence chaque page de l'application. */
	public get pageTitle(): Locator {
		return this._page.locator('sgdf-page-title').first();
	}

	/** Un lien de la barre de navigation, désigné par son libellé (« Projets », « Utilisateurs »…). */
	public navLink(label: string): Locator {
		return this._page.getByTestId('navbar-nav-link').filter({ hasText: label });
	}

	/** Ouvre une page de l'application, protégée ou non. */
	public async visit(path: string): Promise<void> {
		await this._page.goto(path);
	}

	/** Prend la main sur l'horloge du navigateur, avant d'ouvrir la page dont on veut observer le rafraîchissement. */
	public async controlClock(): Promise<void> {
		await this._page.clock.install();
	}

	/** Fait passer le temps du navigateur, minuteurs compris, sans attendre réellement. */
	public async letTimePass(seconds: number): Promise<void> {
		await this._page.clock.fastForward(seconds * 1000);
		// Le service de rafraîchissement vérifie les sources toutes les cinq secondes.
		await this._page.clock.runFor(6_000);
	}

	/** Supprime le jeton d'accès de la session, comme à son expiration : le jeton de rafraîchissement reste. */
	public async expireAccessToken(): Promise<void> {
		await this._page.context().clearCookies({ name: 'registry_access_token' });
	}

	public async reload(): Promise<void> {
		await this._page.reload();
	}

	/** Rend le fournisseur d'identité injoignable pour la prochaine tentative de connexion. */
	public async makeIdentityProviderUnreachable(): Promise<void> {
		await this._page.route('**/api/v2/authentication/login/uri**', (route) => route.abort('connectionrefused'), {
			times: 1,
		});
	}

	/** Clique sur « Se connecter » puis s'authentifie auprès du fournisseur d'identité. */
	public async signIn(account: Account): Promise<void> {
		await this.loginButton.click();
		await idp().login(this._page, account, password());
	}

	/** Se déconnecte depuis le menu du compte et revient dans l'application. */
	public async signOut(): Promise<void> {
		await this.accountMenu.click();
		await this._logout.click();
		await idp().returnToAppAfterLogout(this._page);
	}
}
