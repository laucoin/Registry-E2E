import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';

/** Objectif: Créer un groupe par son formulaire en deux étapes | Périmètre: nom puis membres | Limites: sans disponibilité */
export class GroupFormPage {
	private readonly _name: Locator;
	private readonly _create: Locator;
	private readonly _members: ElementPicker;
	private readonly _addMembers: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this._name = _page.getByTestId('group-form-name-input').getByRole('textbox');
		this._create = _page.getByTestId('group-form-actions').getByTestId('form-actions-submit');
		this._members = new ElementPicker(_page.getByTestId('group-form-members-field'));
		this._addMembers = _page.getByTestId('group-form-members-submit-button');
		this._submission = new FormSubmission(_page);
	}

	/** Le groupe est créé à la première étape ; les membres lui sont ajoutés à la seconde. */
	public async create(projectId: string, name: string, members: string[]): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/groups/create`);
		await this._name.fill(name);
		await this._submission.submit(this._create);
		for (const member of members) await this._members.choose(member);
		await this._submission.submit(this._addMembers);
	}
}
