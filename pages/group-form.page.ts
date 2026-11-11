import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';

/** Objectif: Saisir un groupe dans son formulaire | Périmètre: nom, puis membres à la création | Limites: sans disponibilité */
export class GroupFormPage {
	public readonly name: Locator;
	private readonly _save: Locator;
	private readonly _members: ElementPicker;
	private readonly _addMembers: Locator;
	private readonly _skipMembers: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this.name = _page.getByTestId('group-form-name-input').getByRole('textbox');
		this._save = _page.getByTestId('group-form-actions').getByTestId('form-actions-submit');
		this._members = new ElementPicker(_page.getByTestId('group-form-members-field'));
		this._addMembers = _page.getByTestId('group-form-members-submit-button');
		this._skipMembers = _page.getByTestId('group-form-members-skip-button');
		this._submission = new FormSubmission(_page);
	}

	public async create(projectId: string, name: string, members: string[]): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/groups/create`);
		await this.createOpened(name, members);
	}

	/** Le groupe est créé à la première étape ; la seconde lui ajoute les membres, ou est passée quand il n'en a pas. */
	public async createOpened(name: string, members: string[]): Promise<void> {
		await this.save(name);
		for (const member of members) await this._members.choose(member);
		if (members.length) await this._submission.submit(this._addMembers);
		else await this._submission.submit(this._skipMembers);
	}

	/** Enregistre le nom : première étape d'une création, ou modification en une seule étape. */
	public async save(name: string): Promise<void> {
		await this.name.fill(name);
		await this._submission.submit(this._save);
	}
}
