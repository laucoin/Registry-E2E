import type { Locator } from '@playwright/test';

/**
 * Objectif: Lire et écrire les communications d'un mouvement ou d'une alerte | Périmètre: messages, auteurs, alerte
 * liée, envoi au bouton ou au raccourci | Limites: sans création d'alerte depuis le tiroir.
 */
export class CommunicationsDrawer {
	/** Les messages, du plus ancien au plus récent. */
	public readonly messages: Locator;
	public readonly authors: Locator;
	public readonly alertTitles: Locator;
	private readonly _message: Locator;
	private readonly _send: Locator;

	constructor(public readonly root: Locator) {
		this.messages = root.getByTestId('dialog-element-content');
		this.authors = root.getByTestId('dialog-element-author');
		this.alertTitles = root.getByTestId('dialog-element-alert-title');
		this._message = root.getByTestId('communication-form-message-textarea').getByRole('textbox');
		this._send = root.getByTestId('communication-form-submit-button');
	}

	public async send(message: string): Promise<void> {
		await this._message.fill(message);
		await this._send.click();
	}

	/** Envoie au raccourci clavier Ctrl + Entrée. */
	public async sendWithShortcut(message: string): Promise<void> {
		await this._message.fill(message);
		await this._message.press('Control+Enter');
	}
}
