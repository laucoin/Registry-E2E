import type { Locator, Page } from '@playwright/test';

import { Toasts } from '@components/toasts.component';

/**
 * Objectif: Soumettre un formulaire et en attendre l'issue | Périmètre: tout formulaire qui affiche ses erreurs dans
 * `app-form-error` | Limites: pas les dialogs de confirmation, qui ont leur propre zone d'erreur.
 *
 * Un formulaire refusé reste ouvert avec le message du backend (§8.1) : sans ce composant, un test attendrait la suite
 * jusqu'au timeout et le rapport ne dirait pas pourquoi. Ici l'échec cite le message affiché à l'utilisateur, qu'il soit
 * dans le formulaire ou, pour les erreurs que le frontend traite globalement (p. ex. 429), dans un toast.
 */
export class FormSubmission {
	private readonly _formError: Locator;
	private readonly _toastError: Locator;

	constructor(page: Page) {
		this._formError = page.getByTestId('form-error-callout');
		this._toastError = new Toasts(page).error;
	}

	/** Clique sur le bouton d'envoi, puis attend qu'il disparaisse (étape suivante ou page d'origine) ou qu'une erreur s'affiche. */
	public async submit(button: Locator): Promise<void> {
		await button.click();
		await Promise.race([
			button.waitFor({ state: 'detached' }),
			this._formError.waitFor({ state: 'visible' }),
			this._toastError.waitFor({ state: 'visible' }),
		]);
		await this._failIfShown(this._formError, 'in the form');
		await this._failIfShown(this._toastError, 'in a toast');
	}

	private async _failIfShown(error: Locator, where: string): Promise<void> {
		if (!(await error.first().isVisible())) return;
		const title = (await error.first().getAttribute('title')) ?? '';
		const message = (await error.first().innerText()).trim();
		throw new Error(`The submission was rejected ${where}: ${`${title} ${message}`.trim()}`);
	}
}
