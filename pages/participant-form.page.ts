import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';

export interface ParticipantIdentity {
	firstName: string;
	lastName: string;
	/** Au format de saisie de l'UI : jj/mm/aaaa. */
	birthday: string;
}

/** Une borne de disponibilité, au format de saisie de l'UI : jj/mm/aaaa et hh:mm. */
export interface UiDateTime {
	date: string;
	time: string;
}

export interface ParticipantDetails extends Partial<ParticipantIdentity> {
	start?: UiDateTime;
	end?: UiDateTime;
	groups?: string[];
}

/** Objectif: Saisir un participant dans son formulaire | Périmètre: identité, disponibilité, groupes | Limites: sans utilisateur lié */
export class ParticipantFormPage {
	public readonly firstName: Locator;
	public readonly lastName: Locator;
	public readonly birthday: Locator;
	/** Les groupes choisis, affichés sous le champ de recherche. */
	public readonly chosenGroups: Locator;
	private readonly _start: Locator;
	private readonly _end: Locator;
	private readonly _groups: ElementPicker;
	private readonly _submit: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this.firstName = _page.getByTestId('participant-form-first-name-input').getByRole('textbox');
		this.lastName = _page.getByTestId('participant-form-last-name-input').getByRole('textbox');
		this.birthday = _page.getByTestId('participant-form-birthday-picker').getByRole('textbox');
		this._start = _page.getByTestId('participant-form-begin-date-time-picker');
		this._end = _page.getByTestId('participant-form-end-date-time-picker');
		const groups = _page.getByTestId('participant-form-groups-field');
		this._groups = new ElementPicker(groups);
		this.chosenGroups = groups.getByTestId('select-elements-field-row');
		this._submit = _page.getByTestId('participant-form-actions').getByTestId('form-actions-submit');
		this._submission = new FormSubmission(_page);
	}

	public async create(projectId: string, identity: ParticipantIdentity): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/participants/create`);
		await this.save(identity);
	}

	/** Le jour d'une borne de disponibilité (`start` ou `end`), tel que le formulaire l'affiche. */
	public availabilityDate(bound: 'start' | 'end'): Locator {
		return (bound === 'start' ? this._start : this._end).getByPlaceholder('jj/mm/aaaa');
	}

	/** Remplit les champs donnés puis enregistre ; le formulaire renvoie vers la page d'origine, sa disparition signale l'enregistrement. */
	public async save(details: ParticipantDetails): Promise<void> {
		await this._fillIdentity(details);
		await this._fillDateTime(this._start, details.start);
		await this._fillDateTime(this._end, details.end);
		for (const group of details.groups ?? []) await this._groups.choose(group);
		await this._submission.submit(this._submit);
	}

	private async _fillIdentity(identity: Partial<ParticipantIdentity>): Promise<void> {
		if (identity.firstName !== undefined) await this.firstName.fill(identity.firstName);
		if (identity.lastName !== undefined) await this.lastName.fill(identity.lastName);
		if (identity.birthday !== undefined) await this.birthday.fill(identity.birthday);
	}

	private async _fillDateTime(picker: Locator, value: UiDateTime | undefined): Promise<void> {
		if (!value) return;
		await picker.getByPlaceholder('jj/mm/aaaa').fill(value.date);
		await picker.getByPlaceholder('hh:mm').fill(value.time);
	}
}
