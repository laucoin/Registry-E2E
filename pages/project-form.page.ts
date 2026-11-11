import type { Locator, Page } from '@playwright/test';

import { DateTimePicker, type UiDateTime } from '@components/date-time-picker.component';
import { FormSubmission } from '@components/form-submission.component';

export interface ProjectInformation {
	name?: string;
	begin?: UiDateTime;
	end?: UiDateTime;
}

/**
 * Objectif: Saisir un projet dans son formulaire | Périmètre: informations, options, invitation (création seulement) |
 * Limites: l'invitation est passée ; ses champs sont pilotés par les tests des membres.
 */
export class ProjectFormPage {
	public readonly name: Locator;
	/** Les champs portent leur message d'erreur dans l'attribut `error`. */
	public readonly nameField: Locator;
	public readonly beginField: Locator;
	public readonly endField: Locator;
	public readonly begin: DateTimePicker;
	public readonly end: DateTimePicker;
	public readonly options: Locator;
	public readonly checkedOptions: Locator;
	public readonly invitationStep: Locator;
	public readonly createdCallout: Locator;
	private readonly _selectAll: Locator;
	private readonly _next: Locator;
	private readonly _saveOptions: Locator;
	private readonly _skipInvitation: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this.nameField = _page.getByTestId('project-information-fields-name-input');
		this.name = this.nameField.getByRole('textbox');
		this.beginField = _page.getByTestId('project-information-fields-begin-date-time-picker');
		this.endField = _page.getByTestId('project-information-fields-end-date-time-picker');
		this.begin = new DateTimePicker(this.beginField);
		this.end = new DateTimePicker(this.endField);
		this.options = _page.getByTestId('project-options-fields-option-switch').getByRole('switch');
		this.checkedOptions = _page
			.getByTestId('project-options-fields-option-switch')
			.getByRole('switch', { checked: true });
		this.invitationStep = _page.getByTestId('project-form-stepper-invitation-step');
		this.createdCallout = _page.getByTestId('project-form-created-callout');
		this._selectAll = _page.getByTestId('project-options-fields-select-all-checkbox');
		this._next = _page.getByTestId('project-form-information-next-submit');
		this._saveOptions = _page.getByTestId('project-form-options-submit');
		this._skipInvitation = _page.getByTestId('project-form-invitation-skip-button');
		this._submission = new FormSubmission(_page);
	}

	/** Crée un projet sans option ni invitation et renvoie son identifiant. */
	public async create(name: string): Promise<string> {
		await this.openCreation();
		await this.fillInformation({ name });
		await this.saveOptions();
		return this.skipInvitation();
	}

	public async openCreation(): Promise<void> {
		await this._page.goto('/projects/create');
	}

	public async openEdition(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/edit`);
	}

	/** Remplit la première étape et passe à celle des options. */
	public async fillInformation(information: ProjectInformation): Promise<void> {
		if (information.name !== undefined) await this.name.fill(information.name);
		await this.begin.fill(information.begin);
		await this.end.fill(information.end);
		await this._next.click();
	}

	/** L'interrupteur d'une option, désigné par son nom (« Gestion des alertes »…) ; il porte son erreur dans `error`. */
	public option(label: string): Locator {
		return this._page.getByTestId('project-options-fields-option-switch').filter({ hasText: `(${label})` });
	}

	/** Envoie l'étape des options sans attendre : la validation du frontend doit la retenir. */
	public async submitRejected(): Promise<void> {
		await this._saveOptions.click();
	}

	/** Active toutes les options d'un coup. */
	public async selectAllOptions(): Promise<void> {
		await this._selectAll.click();
	}

	/** Enregistre le projet depuis l'étape des options. */
	public async saveOptions(): Promise<void> {
		await this._submission.submit(this._saveOptions);
	}

	/** Passe l'invitation : l'accueil du projet s'ouvre et son URL donne l'identifiant. */
	public async skipInvitation(): Promise<string> {
		await this._skipInvitation.click();
		await this._page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
		return this._page.url().split('/').pop() ?? '';
	}
}
