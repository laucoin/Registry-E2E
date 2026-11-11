import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Objectif: Répondre à la dialog de confirmation des actions sensibles | Périmètre: le `confirmation-dialog` global, avec ou
 * sans phrase à saisir | Limites: ne lit pas le message affiché.
 */
export class ConfirmationDialog {
	public readonly root: Locator;
	private readonly _phrase: Locator;
	private readonly _confirm: Locator;

	constructor(page: Page) {
		this.root = page.getByTestId('confirmation-dialog');
		this._phrase = this.root.getByTestId('confirmation-dialog-phrase-input').getByRole('textbox');
		this._confirm = this.root.getByTestId('confirmation-dialog-confirm-button');
	}

	/** Confirme ; la phrase n'est demandée que pour les actions irréversibles. */
	public async confirm(phrase?: string): Promise<void> {
		if (phrase) await this._typePhrase(phrase);
		await this._confirm.click();
		await this._confirm.waitFor({ state: 'hidden' });
	}

	/** La dialog vide la phrase à son ouverture : une saisie trop précoce est effacée, d'où la vérification du bouton. */
	private async _typePhrase(phrase: string): Promise<void> {
		await expect(async () => {
			await this._phrase.fill(phrase);
			await expect(this._confirm).not.toHaveAttribute('disabled', { timeout: 1_000 });
		}).toPass();
	}
}
