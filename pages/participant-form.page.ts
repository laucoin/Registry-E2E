import type { Locator, Page } from '@playwright/test';

import { FormSubmission } from '@components/form-submission.component';

export interface ParticipantIdentity {
	firstName: string;
	lastName: string;
	/** Au format de saisie de l'UI : jj/mm/aaaa. */
	birthday: string;
}

/** Objectif: Créer un participant par son formulaire | Périmètre: identité et date de naissance | Limites: sans utilisateur lié, groupes ni disponibilité */
export class ParticipantFormPage {
	private readonly _firstName: Locator;
	private readonly _lastName: Locator;
	private readonly _birthday: Locator;
	private readonly _submit: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this._firstName = _page.getByTestId('participant-form-first-name-input').getByRole('textbox');
		this._lastName = _page.getByTestId('participant-form-last-name-input').getByRole('textbox');
		this._birthday = _page.getByTestId('participant-form-birthday-picker').getByRole('textbox');
		this._submit = _page.getByTestId('participant-form-actions').getByTestId('form-actions-submit');
		this._submission = new FormSubmission(_page);
	}

	public async create(projectId: string, identity: ParticipantIdentity): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/participants/create`);
		await this._firstName.fill(identity.firstName);
		await this._lastName.fill(identity.lastName);
		await this._birthday.fill(identity.birthday);
		// Le formulaire renvoie vers la page d'origine : sa disparition, et non l'URL, signale l'enregistrement.
		await this._submission.submit(this._submit);
	}
}
