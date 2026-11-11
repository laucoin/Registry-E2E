import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';

/** Objectif: Inviter des utilisateurs dans un projet | Périmètre: rôle et utilisateurs | Limites: sans dates d'accès */
export class ProfileInvitationFormPage {
	/** Le rôle porte son message d'erreur dans l'attribut `error`. */
	public readonly role: Locator;
	private readonly _users: ElementPicker;
	private readonly _submit: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this.role = _page.getByTestId('project-profile-invitation-fields-role-select');
		this._users = new ElementPicker(_page.getByTestId('project-profile-invitation-fields-users-field'));
		this._submit = _page.getByTestId('project-profile-invitation-form-actions').getByTestId('form-actions-submit');
		this._submission = new FormSubmission(_page);
	}

	public async open(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/profiles/invite`);
	}

	/** Les utilisateurs sont cherchés par leur email, que la proposition affiche en premier. */
	public async chooseUser(email: string): Promise<void> {
		await this._users.choose(email);
	}

	public async chooseRole(label: string): Promise<void> {
		await this.role.click();
		await this.role.getByRole('option', { name: label, exact: true }).click();
	}

	/** Envoie un formulaire que la validation du frontend doit retenir : le formulaire reste ouvert. */
	public async inviteRejected(): Promise<void> {
		await this._submit.click();
	}

	public async invite(): Promise<void> {
		await this._submission.submit(this._submit);
	}
}
