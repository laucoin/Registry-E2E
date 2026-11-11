import type { Locator, Page } from '@playwright/test';

/**
 * Objectif: Saisir une nouvelle alerte dans le formulaire de communication | Périmètre: titre et premier message |
 * Limites: sans lien vers un mouvement ni alerte existante.
 */
export class AlertFormPage {
	/** Le titre et le message portent leur message d'erreur dans l'attribut `error`. */
	public readonly titleField: Locator;
	public readonly messageField: Locator;
	private readonly _submit: Locator;

	constructor(root: Locator) {
		this.titleField = root.getByTestId('communication-new-alert-field-title-input');
		this.messageField = root.getByTestId('communication-form-message-textarea');
		this._submit = root.getByTestId('communication-form-submit-button');
	}

	public static in(page: Page, testId: string): AlertFormPage {
		return new AlertFormPage(page.getByTestId(testId));
	}

	public async fill(title: string, message: string): Promise<void> {
		await this.titleField.getByRole('textbox').fill(title);
		await this.messageField.getByRole('textbox').fill(message);
	}

	public async submit(): Promise<void> {
		await this._submit.click();
	}
}
