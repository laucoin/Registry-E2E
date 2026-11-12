import type { Download, Locator, Page } from '@playwright/test';

/** Objectif: Gérer ses données personnelles depuis Mon compte | Périmètre: export et suppression du compte | Limites: la suppression n'est jamais confirmée */
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

	public async goto(): Promise<void> {
		await this._page.goto('/my-account');
	}

	/** Exporte ses propres données et renvoie le fichier téléchargé. */
	public async exportData(): Promise<Download> {
		const file = this._page.waitForEvent('download');
		await this._export.click();
		return file;
	}

	public async openDeletion(): Promise<void> {
		await this._delete.click();
	}

	public async cancelDeletion(): Promise<void> {
		await this.deletionDialog.getByTestId('account-deletion-dialog-cancel-button').click();
	}
}
