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

	/** Un lien de la barre de navigation, désigné par son libellé (« Projets », « Utilisateurs »…). */
	public navLink(label: string): Locator {
		return this._page.getByTestId('navbar-nav-link').filter({ hasText: label });
	}

	/** Ouvre une page de l'application, protégée ou non. */
	public async visit(path: string): Promise<void> {
		await this._page.goto(path);
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
