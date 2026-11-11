import type { Locator, Page } from '@playwright/test';

import { FormSubmission } from '@components/form-submission.component';

/**
 * Objectif: Remplir et envoyer un formulaire ouvert en dialog | Périmètre: tout `app-form-dialog` (véhicule, activité,
 * alerte…) | Limites: les champs propres au formulaire sont pilotés par son page object.
 */
export class FormDialog {
	public readonly root: Locator;
	public readonly submitButton: Locator;
	private readonly _submission: FormSubmission;

	constructor(page: Page, testId: string) {
		this.root = page.getByTestId(testId);
		this.submitButton = this.root.getByTestId('form-dialog-submit');
		this._submission = new FormSubmission(page);
	}

	/** La zone de saisie d'un champ texte du formulaire, désigné par son data-test-id. */
	public textbox(testId: string): Locator {
		return this.root.getByTestId(testId).getByRole('textbox');
	}

	/** Envoie le formulaire et attend la fermeture de la dialog ; échoue avec le message affiché en cas de refus. */
	public submit(): Promise<void> {
		return this._submission.submit(this.submitButton);
	}
}
