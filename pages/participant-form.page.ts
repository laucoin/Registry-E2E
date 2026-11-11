import type { Locator, Page } from '@playwright/test';

import { DateTimePicker, type UiDateTime } from '@components/date-time-picker.component';
import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';

export interface ParticipantIdentity {
	firstName: string;
	lastName: string;
	/** Au format de saisie de l'UI : jj/mm/aaaa. */
	birthday: string;
}

export interface ParticipantDetails extends Partial<ParticipantIdentity> {
	start?: UiDateTime;
	end?: UiDateTime;
	groups?: string[];
}

/** Objectif: Saisir un participant dans son formulaire | Périmètre: identité, disponibilité, groupes | Limites: sans utilisateur lié */
export class ParticipantFormPage {
	public readonly firstName: Locator;
	/** Les champs d'identité portent leur message d'erreur dans l'attribut `error`. */
	public readonly firstNameField: Locator;
	public readonly lastNameField: Locator;
	public readonly birthdayField: Locator;
	public readonly lastName: Locator;
	public readonly birthday: Locator;
	/** Les groupes choisis, affichés sous le champ de recherche. */
	public readonly chosenGroups: Locator;
	public readonly start: DateTimePicker;
	public readonly end: DateTimePicker;
	private readonly _groups: ElementPicker;
	private readonly _submit: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this.firstNameField = _page.getByTestId('participant-form-first-name-input');
		this.lastNameField = _page.getByTestId('participant-form-last-name-input');
		this.birthdayField = _page.getByTestId('participant-form-birthday-picker');
		this.firstName = this.firstNameField.getByRole('textbox');
		this.lastName = this.lastNameField.getByRole('textbox');
		this.birthday = this.birthdayField.getByRole('textbox');
		this.start = new DateTimePicker(_page.getByTestId('participant-form-begin-date-time-picker'));
		this.end = new DateTimePicker(_page.getByTestId('participant-form-end-date-time-picker'));
		const groups = _page.getByTestId('participant-form-groups-field');
		this._groups = new ElementPicker(groups);
		this.chosenGroups = groups.getByTestId('select-elements-field-row');
		this._submit = _page.getByTestId('participant-form-actions').getByTestId('form-actions-submit');
		this._submission = new FormSubmission(_page);
	}

	public async create(projectId: string, identity: ParticipantIdentity): Promise<void> {
		await this.openCreation(projectId);
		await this.save(identity);
	}

	public async openCreation(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/participants/create`);
	}

	/** Envoie le formulaire sans attendre : la validation du frontend doit le retenir. */
	public async submitRejected(): Promise<void> {
		await this._submit.click();
	}

	/** Remplit les champs donnés puis enregistre ; le formulaire renvoie vers la page d'origine, sa disparition signale l'enregistrement. */
	public async save(details: ParticipantDetails): Promise<void> {
		await this._fillIdentity(details);
		await this.start.fill(details.start);
		await this.end.fill(details.end);
		for (const group of details.groups ?? []) await this._groups.choose(group);
		await this._submission.submit(this._submit);
	}

	private async _fillIdentity(identity: Partial<ParticipantIdentity>): Promise<void> {
		if (identity.firstName !== undefined) await this.firstName.fill(identity.firstName);
		if (identity.lastName !== undefined) await this.lastName.fill(identity.lastName);
		if (identity.birthday !== undefined) await this.birthday.fill(identity.birthday);
	}
}
