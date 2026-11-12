import type { Download, Locator, Page } from '@playwright/test';

import { downloadOf } from '@components/download.component';

/** Objectif: Gérer ses données personnelles depuis Mon compte | Périmètre: préférences, export et suppression du compte | Limites: la suppression n'est jamais confirmée */
export class MyAccountPage {
	public readonly deletionDialog: Locator;
	public readonly confirmDeletion: Locator;
	private readonly _export: Locator;
	private readonly _delete: Locator;

	constructor(private readonly _page: Page) {
		this._export = _page.getByTestId('account-personal-data-export-button');
		this._delete = _page.getByTestId('account-personal-data-delete-button');
		this.deletionDialog = _page.getByTestId('account-deletion-dialog-modal');
		this.confirmDeletion = this.deletionDialog.getByTestId('account-deletion-dialog-accept-button');
	}

	/** Les groupes de choix du thème et du rafraîchissement, dont la propriété `value` porte le choix courant. */
	public get themeChoices(): Locator {
		return this._page.getByTestId('account-theme-choices-group');
	}

	public get refreshChoices(): Locator {
		return this._page.getByTestId('account-refresh-modes-group');
	}

	/** Choisit un thème par son libellé (« Clair », « Sombre », « Système ») et attend son enregistrement. */
	public async chooseTheme(label: string): Promise<void> {
		const saved = this._page.waitForResponse((response) => response.url().includes('/users/preferences/theme'));
		await this.themeChoices.getByTestId('account-theme-choice-radio').filter({ hasText: label }).click();
		await saved;
	}

	/** Choisit un mode de rafraîchissement par son libellé (« Désactivée », « Économe », « Normale », « Rapide ») et attend son enregistrement. */
	public async chooseRefresh(label: string): Promise<void> {
		const saved = this._page.waitForResponse((response) =>
			response.url().includes('/users/preferences/refresh-mode'),
		);
		await this.refreshChoices.getByTestId('account-refresh-mode-radio').filter({ hasText: label }).click();
		await saved;
	}

	public async reload(): Promise<void> {
		await this._page.reload();
	}

	public async goto(): Promise<void> {
		await this._page.goto('/my-account');
	}

	/** Exporte ses propres données et renvoie le fichier téléchargé. */
	public async exportData(): Promise<Download> {
		return downloadOf(this._page, () => this._export.click());
	}

	public async openDeletion(): Promise<void> {
		await this._delete.click();
	}

	public async cancelDeletion(): Promise<void> {
		await this.deletionDialog.getByTestId('account-deletion-dialog-cancel-button').click();
	}
}
