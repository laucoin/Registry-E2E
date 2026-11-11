import type { Locator, Page } from '@playwright/test';

import { FormDialog } from '@components/form-dialog.component';

export interface Activity {
	name: string;
	minParticipants: string;
	maxParticipants: string;
}

/** Objectif: Saisir une activité dans sa dialog | Périmètre: nom et fourchette de participants | Limites: sans description, durée ni disponibilité */
export class ActivityFormPage {
	public readonly name: Locator;
	public readonly minParticipants: Locator;
	public readonly maxParticipants: Locator;
	/** Le champ de la fourchette porte son message d'erreur dans l'attribut `error`. */
	public readonly participantsRange: Locator;
	private readonly _dialog: FormDialog;

	constructor(page: Page) {
		this._dialog = new FormDialog(page, 'activity-form-dialog');
		this.name = this._dialog.textbox('activity-form-name-input');
		this.participantsRange = this._dialog.root.getByTestId('activity-form-allowed-participants-field');
		this.minParticipants = this.participantsRange
			.getByTestId('number-range-field-min-input')
			.getByRole('spinbutton');
		this.maxParticipants = this.participantsRange
			.getByTestId('number-range-field-max-input')
			.getByRole('spinbutton');
	}

	public async fill(activity: Partial<Activity>): Promise<void> {
		if (activity.name !== undefined) await this.name.fill(activity.name);
		if (activity.minParticipants !== undefined) await this.minParticipants.fill(activity.minParticipants);
		if (activity.maxParticipants !== undefined) await this.maxParticipants.fill(activity.maxParticipants);
	}

	/** Envoie un formulaire que la validation du frontend doit retenir : la dialog reste ouverte. */
	public async submitRejected(): Promise<void> {
		await this._dialog.submitButton.click();
	}

	public async save(activity: Partial<Activity>): Promise<void> {
		await this.fill(activity);
		await this._dialog.submit();
	}
}
